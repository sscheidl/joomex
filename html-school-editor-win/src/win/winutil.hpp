// Small Win32 helpers: text conversion, files, dialogs, settings. No WebView2 here.
#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "../core/paths.hpp"

namespace hse {

std::wstring toWide(std::string_view utf8);
std::string toUtf8(std::wstring_view wide);

// ---------------------------------------------------------------- files

// ---------------------------------------------------------------- the project boundary
//
// Paths inside the project folder are built from checked segments, but a junction or symbolic link inside
// the folder can lead anywhere. So every read and write first asks the file system where a path really
// leads (GetFinalPathNameByHandleW on an open handle, all links followed) and goes on only if that lies
// inside the project folder as the file system resolves it. Reads check and read through the same handle,
// so nothing can be swapped in between. For writes the folder that receives the file is checked right
// before the write; replacing that folder by a link in the moment between is not caught.

// Application error (bit 29): the path leads out of the project folder.
constexpr DWORD ERROR_OUTSIDE_PROJECT = 0x20000001;

// Where `path` (a file or a folder) really leads, all links followed; nothing if it cannot be opened.
std::optional<std::wstring> resolvedPath(const std::wstring& path);

// The project folder as the file system resolves it, shared by the workers of one project folder. Resolving
// opens the folder and can wait for a network drive, so only worker threads call get(); the window thread
// only creates a new boundary for each project folder. Empty while the folder cannot be reached (then every
// read and write in it fails); tried again on the next call.
class ProjectBoundary {
public:
    explicit ProjectBoundary(std::wstring root) : root_(std::move(root)) {}
    const std::wstring& root() const { return root_; }
    std::wstring get() {
        std::lock_guard lock(mutex_);
        if (final_.empty()) {
#ifdef HSE_TEST_HOOKS
            // Test build only: a slow network drive, to check that the window keeps answering.
            wchar_t delay[16]{};
            const DWORD n = GetEnvironmentVariableW(L"HSE_TEST_RESOLVE_DELAY_MS", delay, 16);
            if (n && n < 16) Sleep(static_cast<DWORD>(std::clamp(_wtoi(delay), 0, 15000)));
#endif
            final_ = resolvedPath(root_).value_or(L"");
        }
        return final_;
    }

private:
    const std::wstring root_;
    std::mutex mutex_;
    std::wstring final_;
};

// True if the resolved path `final` lies inside the resolved folder `rootFinal` (compared without case).
bool within(const std::wstring& rootFinal, const std::wstring& final);

// The folder that receives a new or replaced file `path`: ERROR_SUCCESS if it resolves inside
// `rootFinal`, ERROR_OUTSIDE_PROJECT if not, or the error of opening it.
DWORD checkParentWithin(const std::wstring& path, const std::wstring& rootFinal);

struct ReadResult {
    DWORD error = ERROR_SUCCESS;  // ERROR_SUCCESS, or the Win32 error
    std::string bytes;
};

struct FileIdentity {
    DWORD volume = 0;
    ULONGLONG index = 0;
    bool operator==(const FileIdentity&) const = default;
};

// An open file whose resolved path was checked against the project folder.
class CheckedFile {
public:
    // With an empty `rootFinal` no check is made (only for files outside any project, such as a picture
    // to copy in).
    DWORD open(const std::wstring& path, const std::wstring& rootFinal);
    ~CheckedFile();
    ULONGLONG size() const { return size_; }
    FILETIME time() const { return time_; }
    FileIdentity identity() const { return identity_; }
    ReadResult readAll(std::size_t maxBytes);

private:
    HANDLE h_ = INVALID_HANDLE_VALUE;
    ULONGLONG size_ = 0;
    FILETIME time_{};
    FileIdentity identity_;
};

// Reads a whole file inside the project folder `rootFinal`; files larger than `maxBytes` give
// ERROR_FILE_TOO_LARGE, a path that leads out of the folder ERROR_OUTSIDE_PROJECT.
ReadResult readFileBytes(const std::wstring& path, std::size_t maxBytes, const std::wstring& rootFinal);

// Creates the missing folders of `folder`, but only below an existing folder that resolves inside
// `rootFinal`, and checks the result again.
DWORD createFoldersWithin(const std::wstring& folder, const std::wstring& rootFinal);

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
// Starts in `start`, or in `fallback` if `start` cannot be shown.
std::optional<std::wstring> pickPictureFile(HWND owner, const std::wstring& start, const std::wstring& fallback);
// `askOverwrite` false: no overwrite question; the caller refuses an existing file itself.
std::optional<std::wstring> pickSaveFile(HWND owner, const std::wstring& start, const std::wstring& name, bool askOverwrite);

// ---------------------------------------------------------------- settings (HKCU)

std::wstring readSetting(const wchar_t* name);
void writeSetting(const wchar_t* name, const std::wstring& value);

// %LOCALAPPDATA%\HtmlSchoolEditor\<sub>, created if needed; the temporary folder if that fails.
std::wstring localDataFolder(const wchar_t* sub);
// %LOCALAPPDATA%\HtmlSchoolEditor\<sub>, created if needed; nothing if that fails (no fallback).
std::optional<std::wstring> profileDataFolder(const wchar_t* sub);

}  // namespace hse
