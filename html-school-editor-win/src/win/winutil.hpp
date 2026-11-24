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

// Writes `bytes` to `path` without a moment in which the old file is lost: a temporary file in the same
// folder, flushed, then ReplaceFileW (or MoveFileExW for a new file). Returns ERROR_SUCCESS or the error;
// on an error the old file is unchanged and the temporary file removed.
DWORD writeFileAtomic(const std::wstring& path, std::string_view bytes);

// Creates a new file that must not exist yet (ERROR_FILE_EXISTS otherwise).
DWORD createNewFile(const std::wstring& path, std::string_view bytes);

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
std::optional<std::wstring> pickSaveFile(HWND owner, const std::wstring& start, const std::wstring& name);

// ---------------------------------------------------------------- settings (HKCU)

std::wstring readSetting(const wchar_t* name);
void writeSetting(const wchar_t* name, const std::wstring& value);

// %LOCALAPPDATA%\HtmlSchoolEditor\<sub>, created if needed; the temporary folder if that fails.
std::wstring localDataFolder(const wchar_t* sub);

}  // namespace hse
