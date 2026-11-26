#include "paths.hpp"

#include <algorithm>
#include <array>

namespace hse {

namespace {

bool validUtf8(std::string_view s) {
    std::size_t i = 0;
    while (i < s.size()) {
        const unsigned char c = static_cast<unsigned char>(s[i]);
        std::size_t n;
        unsigned cp;
        if (c < 0x80) { ++i; continue; }
        if (c >= 0xC2 && c <= 0xDF) { n = 2; cp = c & 0x1F; }
        else if (c >= 0xE0 && c <= 0xEF) { n = 3; cp = c & 0x0F; }
        else if (c >= 0xF0 && c <= 0xF4) { n = 4; cp = c & 0x07; }
        else return false;
        if (i + n > s.size()) return false;
        for (std::size_t k = 1; k < n; ++k) {
            const unsigned char d = static_cast<unsigned char>(s[i + k]);
            if ((d & 0xC0) != 0x80) return false;
            cp = (cp << 6) | (d & 0x3F);
        }
        if ((n == 3 && cp < 0x800) || (n == 4 && (cp < 0x10000 || cp > 0x10FFFF)) || (cp >= 0xD800 && cp <= 0xDFFF)) return false;
        i += n;
    }
    return true;
}

int hexValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

char asciiLower(char c) { return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : c; }

// Folds ASCII letters and the umlauts Ä Ö Ü (UTF-8 C3 84, C3 96, C3 9C) to lower case.
std::string fold(std::string_view s) {
    std::string out;
    out.reserve(s.size());
    for (std::size_t i = 0; i < s.size(); ++i) {
        const unsigned char c = static_cast<unsigned char>(s[i]);
        if (c == 0xC3 && i + 1 < s.size()) {
            unsigned char d = static_cast<unsigned char>(s[i + 1]);
            if (d == 0x84 || d == 0x96 || d == 0x9C) d = static_cast<unsigned char>(d + 0x20);
            out += static_cast<char>(c);
            out += static_cast<char>(d);
            ++i;
            continue;
        }
        out += asciiLower(static_cast<char>(c));
    }
    return out;
}

bool isDeviceName(std::string_view seg) {
    const std::string base = fold(seg.substr(0, seg.find('.')));
    static const std::array<std::string_view, 4> plain{"con", "prn", "aux", "nul"};
    if (std::find(plain.begin(), plain.end(), base) != plain.end()) return true;
    if (base.size() == 4 && (base.rfind("com", 0) == 0 || base.rfind("lpt", 0) == 0) && base[3] >= '1' && base[3] <= '9') return true;
    return false;
}

std::string extensionOf(std::string_view name) {
    const auto dot = name.rfind('.');
    if (dot == std::string_view::npos || dot == 0) return {};
    return fold(name.substr(dot + 1));
}

}  // namespace

std::optional<Segments> requestSegments(std::string_view urlPath) {
    constexpr std::size_t maxPathBytes = 2048;
    if (urlPath.empty() || urlPath.front() != '/' || urlPath.size() > maxPathBytes * 3) return std::nullopt;
    Segments out;
    std::size_t pathBytes = 0;
    std::size_t at = 1;
    for (;;) {
        const std::size_t slash = urlPath.find('/', at);
        const std::string_view raw = urlPath.substr(at, slash == std::string_view::npos ? std::string_view::npos : slash - at);
        std::string seg;
        for (std::size_t i = 0; i < raw.size(); ++i) {
            if (raw[i] == '%' && i + 2 < raw.size() && hexValue(raw[i + 1]) >= 0 && hexValue(raw[i + 2]) >= 0) {
                seg += static_cast<char>(hexValue(raw[i + 1]) * 16 + hexValue(raw[i + 2]));
                i += 2;
            } else {
                seg += raw[i];
            }
        }
        if (seg.empty() || seg == "." || seg == ".." || seg.size() > 255 || !validUtf8(seg)) return std::nullopt;
        for (const char ch : seg) {
            const unsigned char c = static_cast<unsigned char>(ch);
            if (c < 0x20 || c == 0x7F || ch == '\\' || ch == ':' || ch == '/' || ch == '*' || ch == '?' || ch == '"' || ch == '<' || ch == '>' || ch == '|') return std::nullopt;
        }
        if (seg.back() == '.' || seg.back() == ' ' || isDeviceName(seg)) return std::nullopt;
        pathBytes += 1 + seg.size();  // slash and decoded UTF-8 bytes
        if (pathBytes > maxPathBytes) return std::nullopt;
        out.push_back(std::move(seg));
        if (out.size() > 32) return std::nullopt;
        if (slash == std::string_view::npos) break;
        at = slash + 1;
    }
    return out;
}

std::optional<std::string> pathOfUrl(std::string_view url, std::string_view origin) {
    if (url.size() < origin.size() || fold(url.substr(0, origin.size())) != fold(origin)) return std::nullopt;
    std::string_view rest = url.substr(origin.size());
    if (rest.empty()) return std::string("/");
    if (rest.front() != '/') return std::nullopt;  // "https://projekt.example.evil/…" or a port
    const auto cut = rest.find_first_of("?#");
    return std::string(rest.substr(0, cut));
}

std::string encodeSegment(std::string_view segment) {
    static const char* hex = "0123456789ABCDEF";
    std::string out;
    for (const char ch : segment) {
        const unsigned char c = static_cast<unsigned char>(ch);
        const bool encode = c < 0x20 || c >= 0x7F || ch == '%' || ch == '#' || ch == '?' || ch == ' ' || ch == '"' || ch == '<' ||
                            ch == '>' || ch == '\\' || ch == '^' || ch == '`' || ch == '{' || ch == '|' || ch == '}' || ch == '/';
        if (encode) {
            out += '%';
            out += hex[c >> 4];
            out += hex[c & 15];
        } else {
            out += ch;
        }
    }
    return out;
}

std::string relativeAddress(const Segments& page, const Segments& file) {
    const std::size_t pageDirs = page.empty() ? 0 : page.size() - 1;
    const std::size_t fileDirs = file.empty() ? 0 : file.size() - 1;
    std::size_t common = 0;
    while (common < pageDirs && common < fileDirs && page[common] == file[common]) ++common;
    std::string out;
    for (std::size_t i = common; i < pageDirs; ++i) out += "../";
    for (std::size_t i = common; i < file.size(); ++i) {
        if (i > common) out += '/';
        out += encodeSegment(file[i]);
    }
    return out;
}

std::string urlPathOf(const Segments& segs) {
    std::string out;
    for (const auto& s : segs) {
        out += '/';
        out += encodeSegment(s);
    }
    return out.empty() ? "/" : out;
}

std::string joinSegments(const Segments& segs) {
    std::string out;
    for (std::size_t i = 0; i < segs.size(); ++i) {
        if (i) out += '/';
        out += segs[i];
    }
    return out;
}

bool equalsIgnoreCase(std::string_view a, std::string_view b) { return fold(a) == fold(b); }

bool differsOnlyInCase(std::string_view a, std::string_view b) { return a != b && fold(a) == fold(b); }

FileKind kindOf(std::string_view name) {
    const std::string ext = extensionOf(name);
    if (ext == "html" || ext == "htm") return FileKind::Page;
    if (ext == "css") return FileKind::Style;
    static const std::array<std::string_view, 11> pictures{"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "jfif", "pjpeg"};
    if (std::find(pictures.begin(), pictures.end(), ext) != pictures.end()) return FileKind::Picture;
    return FileKind::Other;
}

std::string_view contentTypeOf(std::string_view name) {
    const std::string ext = extensionOf(name);
    if (ext == "html" || ext == "htm") return "text/html; charset=utf-8";
    if (ext == "css") return "text/css; charset=utf-8";
    if (ext == "png") return "image/png";
    if (ext == "jpg" || ext == "jpeg" || ext == "jfif" || ext == "pjpeg") return "image/jpeg";
    if (ext == "gif") return "image/gif";
    if (ext == "webp") return "image/webp";
    if (ext == "svg") return "image/svg+xml";
    if (ext == "bmp") return "image/bmp";
    if (ext == "ico") return "image/x-icon";
    if (ext == "avif") return "image/avif";
    if (ext == "txt") return "text/plain; charset=utf-8";
    if (ext == "woff2") return "font/woff2";
    if (ext == "woff") return "font/woff";
    if (ext == "mp3") return "audio/mpeg";
    if (ext == "mp4") return "video/mp4";
    return "application/octet-stream";
}

std::string uniqueName(std::string_view wanted, const std::vector<std::string>& existing) {
    const auto taken = [&](std::string_view n) {
        return std::any_of(existing.begin(), existing.end(), [&](const std::string& e) { return equalsIgnoreCase(e, n); });
    };
    if (!taken(wanted)) return std::string(wanted);
    const auto dot = wanted.rfind('.');
    const std::string_view stem = dot == std::string_view::npos || dot == 0 ? wanted : wanted.substr(0, dot);
    const std::string_view ext = dot == std::string_view::npos || dot == 0 ? std::string_view() : wanted.substr(dot);
    for (int n = 2;; ++n) {
        std::string candidate = std::string(stem) + "-" + std::to_string(n) + std::string(ext);
        if (!taken(candidate)) return candidate;
    }
}

Fingerprint fingerprintOf(std::string_view bytes) {
    std::uint64_t h = 1469598103934665603ULL;
    for (const char c : bytes) {
        h ^= static_cast<unsigned char>(c);
        h *= 1099511628211ULL;
    }
    return {bytes.size(), h};
}

std::string fingerprintText(const Fingerprint& f) {
    static const char* hex = "0123456789abcdef";
    std::string out = std::to_string(f.size) + "-";
    for (int shift = 60; shift >= 0; shift -= 4) out += hex[(f.hash >> shift) & 0xF];
    return out;
}

std::optional<Fingerprint> parseFingerprint(std::string_view text) {
    const auto dash = text.find('-');
    if (dash == std::string_view::npos || dash == 0 || dash > 20 || text.size() - dash - 1 != 16) return std::nullopt;
    Fingerprint f;
    for (std::size_t i = 0; i < dash; ++i) {
        if (text[i] < '0' || text[i] > '9') return std::nullopt;
        const std::uint64_t d = static_cast<std::uint64_t>(text[i] - '0');
        if (f.size > (UINT64_MAX - d) / 10) return std::nullopt;
        f.size = f.size * 10 + d;
    }
    for (std::size_t i = dash + 1; i < text.size(); ++i) {
        const char c = text[i];
        const int v = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1;
        if (v < 0) return std::nullopt;
        f.hash = (f.hash << 4) | static_cast<std::uint64_t>(v);
    }
    return f;
}

std::string base64Encode(std::string_view bytes) {
    static const char* abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve((bytes.size() + 2) / 3 * 4);
    std::size_t i = 0;
    for (; i + 2 < bytes.size(); i += 3) {
        const unsigned v = (static_cast<unsigned char>(bytes[i]) << 16) | (static_cast<unsigned char>(bytes[i + 1]) << 8) | static_cast<unsigned char>(bytes[i + 2]);
        out += abc[v >> 18];
        out += abc[(v >> 12) & 63];
        out += abc[(v >> 6) & 63];
        out += abc[v & 63];
    }
    if (i + 1 == bytes.size()) {
        const unsigned v = static_cast<unsigned char>(bytes[i]) << 16;
        out += abc[v >> 18];
        out += abc[(v >> 12) & 63];
        out += "==";
    } else if (i + 2 == bytes.size()) {
        const unsigned v = (static_cast<unsigned char>(bytes[i]) << 16) | (static_cast<unsigned char>(bytes[i + 1]) << 8);
        out += abc[v >> 18];
        out += abc[(v >> 12) & 63];
        out += abc[(v >> 6) & 63];
        out += '=';
    }
    return out;
}

}  // namespace hse
