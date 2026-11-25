// Small Win32 helpers: text conversion, files, dialogs, settings. No WebView2 here.
#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "../core/paths.hpp"

namespace hse {

std::wstring toWide(std::string_view utf8);
std::string toUtf8(std::wstring_view wide);

// ---------------------------------------------------------------- files

struct ReadResult {
    DWORD error = ERROR_SUCCESS;  // ERROR_SUCCESS, or the Win32 error
    std::string bytes;
};
// Reads a whole file; files larger than `maxBytes` give ERROR_FILE_TOO_LARGE.
ReadResult readFileBytes(const std::wstring& path, std::size_t maxBytes);

// Outcome of writing a file. Both writers first write a temporary file in the same folder and flush it, so
// the file name never holds half a file.
struct WriteResult {
    DWORD error = ERROR_SUCCESS;
    // ReplaceFileW can fail half way (see its documentation). The writer then puts a file back under the
    // name, the new content first. If the old content could not go back, it stays in this file in the same
    // folder and is reported here; it is never deleted after a failure.
    std::wstring keptOld;
};

// Replaces the existing file `path` (ReplaceFileW with a backup name). If `path` does not exist, nothing
// is created: ERROR_FILE_NOT_FOUND. Metadata policy: content first. ReplaceFileW carries attributes and
// the ACL of the old file over where the file system allows it; if it cannot (some network shares), the
// new content is written anyway and the file keeps what the folder gives it.
WriteResult replaceFileAtomic(const std::wstring& path, std::string_view bytes);

// Creates `path`, which must not exist yet (ERROR_FILE_EXISTS otherwise, also if another program creates
// it meanwhile): the temporary file is renamed without replacing.
WriteResult createFileAtomic(const std::wstring& path, std::string_view bytes);

// Creates all missing folders of `folder`.
DWORD createFolders(const std::wstring& folder);

bool isFolder(const std::wstring& path);
bool isFile(const std::wstring& path);

// The exact spelling of the last component of `path` on disk, or nothing if it does not exist.
std::optional<std::wstring> actualName(const std::wstring& path);

// A short German sentence for a pupil about a Win32 error while reading or writing.
std::string errorText(DWORD error);

std::wstring parentOf(const std::wstring& path);
std::wstring lastComponent(const std::wstring& path);
std::wstring joinPath(const std::wstring& folder, const Segments& segs);

// The segments of `path` below `root`, if `path` lies inside `root` (compared without case).
std::optional<Segments> segmentsBelow(const std::wstring& root, const std::wstring& path);

// ---------------------------------------------------------------- dialogs (IFileDialog)

std::optional<std::wstring> pickFolder(HWND owner, const std::wstring& start);
std::optional<std::wstring> pickPageFile(HWND owner, const std::wstring& start);
std::optional<std::wstring> pickPictureFile(HWND owner, const std::wstring& start);
// `askOverwrite` false: no overwrite question; the caller refuses an existing file itself.
std::optional<std::wstring> pickSaveFile(HWND owner, const std::wstring& start, const std::wstring& name, bool askOverwrite);

// ---------------------------------------------------------------- settings (HKCU)

std::wstring readSetting(const wchar_t* name);
void writeSetting(const wchar_t* name, const std::wstring& value);

// %LOCALAPPDATA%\HtmlSchoolEditor\<sub>, created if needed; the temporary folder if that fails.
std::wstring localDataFolder(const wchar_t* sub);

}  // namespace hse
