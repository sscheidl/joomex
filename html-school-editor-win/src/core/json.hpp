// Minimal JSON for the messages between the user interface and the core. Strings are UTF-8.
// Portable C++20, no Windows headers: unit-tested on any platform.
#pragma once

#include <map>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace hse {

class Json {
public:
    enum class Type { Null, Bool, Number, String, Array, Object };

    Json() = default;
    Json(std::nullptr_t) {}
    Json(bool b) : type_(Type::Bool), bool_(b) {}
    Json(int n) : type_(Type::Number), number_(n) {}
    Json(long long n) : type_(Type::Number), number_(static_cast<double>(n)) {}
    Json(double n) : type_(Type::Number), number_(n) {}
    Json(const char* s) : type_(Type::String), string_(s) {}
    Json(std::string s) : type_(Type::String), string_(std::move(s)) {}
    Json(std::string_view s) : type_(Type::String), string_(s) {}

    static Json array() { Json j; j.type_ = Type::Array; return j; }
    static Json object() { Json j; j.type_ = Type::Object; return j; }

    Type type() const { return type_; }
    bool isNull() const { return type_ == Type::Null; }
    bool isString() const { return type_ == Type::String; }
    bool isNumber() const { return type_ == Type::Number; }
    bool isBool() const { return type_ == Type::Bool; }
    bool isArray() const { return type_ == Type::Array; }
    bool isObject() const { return type_ == Type::Object; }

    // Typed reads with a fallback for a missing or differently typed value.
    const std::string& str() const;
    double num(double fallback = 0) const { return type_ == Type::Number ? number_ : fallback; }
    bool boolean(bool fallback = false) const { return type_ == Type::Bool ? bool_ : fallback; }

    // Object access. `at` on a missing key or a non-object gives a shared null value.
    const Json& at(std::string_view key) const;
    Json& set(const std::string& key, Json value);  // returns *this, so calls can be chained
    bool has(std::string_view key) const;
    const std::map<std::string, Json, std::less<>>& members() const { return object_; }

    // Array access.
    std::size_t size() const { return type_ == Type::Array ? array_.size() : 0; }
    const Json& operator[](std::size_t i) const;
    Json& push(Json value);                         // returns *this

    std::string dump() const;

    // Parses one JSON text (RFC 8259). Returns nothing for invalid input, input with trailing garbage,
    // nesting deeper than 64 levels, or invalid UTF-8 / lone surrogates in strings.
    static std::optional<Json> parse(std::string_view text);

private:
    void dumpTo(std::string& out) const;

    Type type_ = Type::Null;
    bool bool_ = false;
    double number_ = 0;
    std::string string_;
    std::vector<Json> array_;
    std::map<std::string, Json, std::less<>> object_;
};

// Appends `s` as a JSON string literal (with quotes) to `out`.
void appendJsonString(std::string& out, std::string_view s);

}  // namespace hse
