#include "json.hpp"

#include <charconv>
#include <cmath>
#include <cstdio>

namespace hse {

namespace {

const Json& nullJson() {
    static const Json n;
    return n;
}

const std::string& emptyString() {
    static const std::string s;
    return s;
}

void appendUtf8(std::string& out, unsigned cp) {
    if (cp < 0x80) {
        out += static_cast<char>(cp);
    } else if (cp < 0x800) {
        out += static_cast<char>(0xC0 | (cp >> 6));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        out += static_cast<char>(0xE0 | (cp >> 12));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else {
        out += static_cast<char>(0xF0 | (cp >> 18));
        out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    }
}

// Length of the valid UTF-8 sequence at s[i], or 0 if it is not valid (overlong forms and surrogates refused).
std::size_t utf8Length(std::string_view s, std::size_t i) {
    const auto b = [&](std::size_t k) { return static_cast<unsigned char>(s[k]); };
    const unsigned c = b(i);
    if (c < 0x80) return 1;
    std::size_t n;
    unsigned cp;
    if (c >= 0xC2 && c <= 0xDF) { n = 2; cp = c & 0x1F; }
    else if (c >= 0xE0 && c <= 0xEF) { n = 3; cp = c & 0x0F; }
    else if (c >= 0xF0 && c <= 0xF4) { n = 4; cp = c & 0x07; }
    else return 0;
    if (i + n > s.size()) return 0;
    for (std::size_t k = 1; k < n; ++k) {
        if ((b(i + k) & 0xC0) != 0x80) return 0;
        cp = (cp << 6) | (b(i + k) & 0x3F);
    }
    if ((n == 3 && cp < 0x800) || (n == 4 && (cp < 0x10000 || cp > 0x10FFFF))) return 0;
    if (cp >= 0xD800 && cp <= 0xDFFF) return 0;
    return n;
}

class Parser {
public:
    explicit Parser(std::string_view t) : t_(t) {}

    std::optional<Json> run() {
        auto v = value(0);
        if (!v) return std::nullopt;
        ws();
        if (i_ != t_.size()) return std::nullopt;
        return v;
    }

private:
    void ws() {
        while (i_ < t_.size() && (t_[i_] == ' ' || t_[i_] == '\t' || t_[i_] == '\n' || t_[i_] == '\r')) ++i_;
    }

    bool lit(std::string_view w) {
        if (t_.substr(i_, w.size()) != w) return false;
        i_ += w.size();
        return true;
    }

    std::optional<Json> value(int depth) {
        if (depth > 64) return std::nullopt;
        ws();
        if (i_ >= t_.size()) return std::nullopt;
        const char c = t_[i_];
        if (c == '{') return object(depth);
        if (c == '[') return array(depth);
        if (c == '"') {
            auto s = string();
            if (!s) return std::nullopt;
            return Json(std::move(*s));
        }
        if (lit("true")) return Json(true);
        if (lit("false")) return Json(false);
        if (lit("null")) return Json();
        return number();
    }

    std::optional<Json> object(int depth) {
        ++i_;
        Json o = Json::object();
        ws();
        if (i_ < t_.size() && t_[i_] == '}') { ++i_; return o; }
        for (;;) {
            ws();
            if (i_ >= t_.size() || t_[i_] != '"') return std::nullopt;
            auto k = string();
            if (!k) return std::nullopt;
            ws();
            if (i_ >= t_.size() || t_[i_] != ':') return std::nullopt;
            ++i_;
            auto v = value(depth + 1);
            if (!v) return std::nullopt;
            o.set(*k, std::move(*v));
            ws();
            if (i_ < t_.size() && t_[i_] == ',') { ++i_; continue; }
            if (i_ < t_.size() && t_[i_] == '}') { ++i_; return o; }
            return std::nullopt;
        }
    }

    std::optional<Json> array(int depth) {
        ++i_;
        Json a = Json::array();
        ws();
        if (i_ < t_.size() && t_[i_] == ']') { ++i_; return a; }
        for (;;) {
            auto v = value(depth + 1);
            if (!v) return std::nullopt;
            a.push(std::move(*v));
            ws();
            if (i_ < t_.size() && t_[i_] == ',') { ++i_; continue; }
            if (i_ < t_.size() && t_[i_] == ']') { ++i_; return a; }
            return std::nullopt;
        }
    }

    std::optional<unsigned> hex4() {
        if (i_ + 4 > t_.size()) return std::nullopt;
        unsigned v = 0;
        for (int k = 0; k < 4; ++k) {
            const char c = t_[i_++];
            v <<= 4;
            if (c >= '0' && c <= '9') v |= static_cast<unsigned>(c - '0');
            else if (c >= 'a' && c <= 'f') v |= static_cast<unsigned>(c - 'a' + 10);
            else if (c >= 'A' && c <= 'F') v |= static_cast<unsigned>(c - 'A' + 10);
            else return std::nullopt;
        }
        return v;
    }

    std::optional<std::string> string() {
        ++i_;  // opening quote
        std::string out;
        while (i_ < t_.size()) {
            const unsigned char c = static_cast<unsigned char>(t_[i_]);
            if (c == '"') { ++i_; return out; }
            if (c < 0x20) return std::nullopt;
            if (c == '\\') {
                if (++i_ >= t_.size()) return std::nullopt;
                const char e = t_[i_++];
                switch (e) {
                    case '"': out += '"'; break;
                    case '\\': out += '\\'; break;
                    case '/': out += '/'; break;
                    case 'b': out += '\b'; break;
                    case 'f': out += '\f'; break;
                    case 'n': out += '\n'; break;
                    case 'r': out += '\r'; break;
                    case 't': out += '\t'; break;
                    case 'u': {
                        auto u = hex4();
                        if (!u) return std::nullopt;
                        unsigned cp = *u;
                        if (cp >= 0xD800 && cp <= 0xDBFF) {
                            if (!lit("\\u")) return std::nullopt;
                            auto lo = hex4();
                            if (!lo || *lo < 0xDC00 || *lo > 0xDFFF) return std::nullopt;
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (*lo - 0xDC00);
                        } else if (cp >= 0xDC00 && cp <= 0xDFFF) {
                            return std::nullopt;
                        }
                        appendUtf8(out, cp);
                        break;
                    }
                    default: return std::nullopt;
                }
                continue;
            }
            const std::size_t n = utf8Length(t_, i_);
            if (!n) return std::nullopt;
            out.append(t_.substr(i_, n));
            i_ += n;
        }
        return std::nullopt;
    }

    std::optional<Json> number() {
        const std::size_t start = i_;
        if (i_ < t_.size() && t_[i_] == '-') ++i_;
        if (i_ >= t_.size()) return std::nullopt;
        if (t_[i_] == '0') ++i_;
        else if (t_[i_] >= '1' && t_[i_] <= '9') while (i_ < t_.size() && t_[i_] >= '0' && t_[i_] <= '9') ++i_;
        else return std::nullopt;
        if (i_ < t_.size() && t_[i_] == '.') {
            ++i_;
            if (i_ >= t_.size() || t_[i_] < '0' || t_[i_] > '9') return std::nullopt;
            while (i_ < t_.size() && t_[i_] >= '0' && t_[i_] <= '9') ++i_;
        }
        if (i_ < t_.size() && (t_[i_] == 'e' || t_[i_] == 'E')) {
            ++i_;
            if (i_ < t_.size() && (t_[i_] == '+' || t_[i_] == '-')) ++i_;
            if (i_ >= t_.size() || t_[i_] < '0' || t_[i_] > '9') return std::nullopt;
            while (i_ < t_.size() && t_[i_] >= '0' && t_[i_] <= '9') ++i_;
        }
        double v = 0;
        const auto r = std::from_chars(t_.data() + start, t_.data() + i_, v);
        if (r.ec != std::errc()) return std::nullopt;
        return Json(v);
    }

    std::string_view t_;
    std::size_t i_ = 0;
};

}  // namespace

const std::string& Json::str() const {
    return type_ == Type::String ? string_ : emptyString();
}

const Json& Json::at(std::string_view key) const {
    if (type_ != Type::Object) return nullJson();
    const auto it = object_.find(key);
    return it == object_.end() ? nullJson() : it->second;
}

bool Json::has(std::string_view key) const {
    return type_ == Type::Object && object_.find(key) != object_.end();
}

Json& Json::set(const std::string& key, Json value) {
    if (type_ != Type::Object) { *this = object(); }
    object_[key] = std::move(value);
    return *this;
}

const Json& Json::operator[](std::size_t i) const {
    return type_ == Type::Array && i < array_.size() ? array_[i] : nullJson();
}

Json& Json::push(Json value) {
    if (type_ != Type::Array) { *this = array(); }
    array_.push_back(std::move(value));
    return *this;
}

void appendJsonString(std::string& out, std::string_view s) {
    static const char* hex = "0123456789abcdef";
    out += '"';
    for (const char ch : s) {
        const unsigned char c = static_cast<unsigned char>(ch);
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    out += "\\u00";
                    out += hex[c >> 4];
                    out += hex[c & 15];
                } else {
                    out += ch;
                }
        }
    }
    out += '"';
}

void Json::dumpTo(std::string& out) const {
    switch (type_) {
        case Type::Null: out += "null"; break;
        case Type::Bool: out += bool_ ? "true" : "false"; break;
        case Type::Number: {
            if (!std::isfinite(number_)) { out += "null"; break; }
            char buf[32];
            const auto r = std::to_chars(buf, buf + sizeof buf, number_);
            out.append(buf, r.ptr);
            break;
        }
        case Type::String: appendJsonString(out, string_); break;
        case Type::Array: {
            out += '[';
            bool first = true;
            for (const auto& v : array_) {
                if (!first) out += ',';
                first = false;
                v.dumpTo(out);
            }
            out += ']';
            break;
        }
        case Type::Object: {
            out += '{';
            bool first = true;
            for (const auto& [k, v] : object_) {
                if (!first) out += ',';
                first = false;
                appendJsonString(out, k);
                out += ':';
                v.dumpTo(out);
            }
            out += '}';
            break;
        }
    }
}

std::string Json::dump() const {
    std::string out;
    dumpTo(out);
    return out;
}

std::optional<Json> Json::parse(std::string_view text) {
    return Parser(text).run();
}

}  // namespace hse
