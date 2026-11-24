// Project-relative paths and the addresses between them. Portable C++20, no Windows headers.
//
// A project path is a list of segments below the project folder, as UTF-8 strings, for example
// {"seiten", "tiere.html"}. The engine resolves the pupil's addresses; this code only checks what
// arrives in a request, writes addresses for the picture dialog and names content types.
#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace hse {

using Segments = std::vector<std::string>;

// The path part of a request URL ("/seiten/tiere.html", without query or fragment) as project segments.
// Percent escapes are decoded (the result must be valid UTF-8). Refused (nothing returned): empty paths,
// empty segments, "." and "..", backslashes, control characters, ':' (drive letters and alternate data
// streams), segments ending in '.' or ' ', Windows device names (CON, NUL, COM1 …, also with an extension),
// more than 32 segments, segments longer than 255 bytes.
std::optional<Segments> requestSegments(std::string_view urlPath);

// Splits a URL ("https://projekt.example/a/b.png?x#y") into its path ("/a/b.png") if it belongs to the
// given origin ("https://projekt.example"), case-insensitive for scheme and host. Nothing for other origins.
std::optional<std::string> pathOfUrl(std::string_view url, std::string_view origin);

// One segment written as part of an address: '%', '#', '?', space, '"', '<', '>', '\', '^', '`', '{',
// '|', '}' and control characters are percent-encoded; letters with umlauts stay readable.
std::string encodeSegment(std::string_view segment);

// The address that a page at `page` (segments including its file name) writes to reach `file`:
// "katze.png", "bilder/katze.png", "../bilder/katze.png". Folder names compare exactly.
std::string relativeAddress(const Segments& page, const Segments& file);

// The URL path of project segments ("/seiten/tiere%20neu.html").
std::string urlPathOf(const Segments& segs);

// Display form "seiten/tiere.html".
std::string joinSegments(const Segments& segs);

// True if both names are equal when ASCII letters and the German umlauts Ä/ä, Ö/ö, Ü/ü are compared
// without case, but not equal exactly. Windows finds such a file; a web server would not.
bool differsOnlyInCase(std::string_view a, std::string_view b);
bool equalsIgnoreCase(std::string_view a, std::string_view b);

enum class FileKind { Other, Page, Style, Picture };
FileKind kindOf(std::string_view name);
std::string_view contentTypeOf(std::string_view name);

// A name for a copy in a folder that already holds `existing` names: "katze.png", "katze-2.png", …
// Compared without case, as Windows does.
std::string uniqueName(std::string_view wanted, const std::vector<std::string>& existing);

// Fingerprint of file content for the conflict check before saving.
struct Fingerprint {
    std::uint64_t size = 0;
    std::uint64_t hash = 0;  // FNV-1a 64
    bool operator==(const Fingerprint&) const = default;
};
Fingerprint fingerprintOf(std::string_view bytes);

std::string base64Encode(std::string_view bytes);

}  // namespace hse
