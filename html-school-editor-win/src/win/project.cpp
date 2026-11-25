#include "project.hpp"

namespace hse {

namespace {

constexpr int kMaxDepth = 8;
constexpr std::size_t kMaxEntries = 3000;

void scanFolder(const std::wstring& folder, Segments& prefix, int depth, std::vector<ProjectEntry>& out) {
    if (depth > kMaxDepth || out.size() >= kMaxEntries) return;
    WIN32_FIND_DATAW fd;
    const HANDLE h = FindFirstFileExW((folder + L"\\*").c_str(), FindExInfoBasic, &fd, FindExSearchNameMatch, nullptr, FIND_FIRST_EX_LARGE_FETCH);
    if (h == INVALID_HANDLE_VALUE) return;
    std::vector<std::wstring> subfolders;
    do {
        const std::wstring name = fd.cFileName;
        if (name == L"." || name == L".." || name.empty() || name[0] == L'.') continue;
        if (fd.dwFileAttributes & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)) continue;
        // Junctions, symbolic links and mount points (name surrogates) may lead out of the project folder:
        // neither folders nor files of that kind are listed. Other reparse points (for example files
        // deduplicated by a server) are ordinary content.
        if ((fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) && IsReparseTagNameSurrogate(fd.dwReserved0)) continue;
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) subfolders.push_back(name);  // no loops
            continue;
        }
        const std::string utf8 = toUtf8(name);
        const FileKind kind = kindOf(utf8);
        if (kind == FileKind::Other) continue;
        Segments segs = prefix;
        segs.push_back(utf8);
        out.push_back({std::move(segs), kind});
        if (out.size() >= kMaxEntries) break;
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    for (const auto& sub : subfolders) {
        prefix.push_back(toUtf8(sub));
        scanFolder(folder + L"\\" + sub, prefix, depth + 1, out);
        prefix.pop_back();
    }
}

}  // namespace

std::vector<ProjectEntry> scanProject(const std::wstring& root) {
    std::vector<ProjectEntry> out;
    Segments prefix;
    scanFolder(root, prefix, 0, out);
    return out;
}

void FolderWatcher::start(const std::wstring& root, HWND window, UINT message) {
    stop();
    stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!stopEvent_) return;
    const HANDLE stopEvent = stopEvent_;
    thread_ = std::thread([root, window, message, stopEvent]() {
        const HANDLE dir = CreateFileW(root.c_str(), FILE_LIST_DIRECTORY, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
                                       OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OVERLAPPED, nullptr);
        if (dir == INVALID_HANDLE_VALUE) return;
        OVERLAPPED ov{};
        ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        alignas(DWORD) BYTE buffer[16 * 1024];
        for (;;) {
            ResetEvent(ov.hEvent);
            const DWORD filter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_DIR_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_SIZE;
            if (!ReadDirectoryChangesW(dir, buffer, sizeof buffer, TRUE, filter, nullptr, &ov, nullptr)) break;  // not supported here
            const HANDLE waits[2] = {ov.hEvent, stopEvent};
            const DWORD w = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
            if (w != WAIT_OBJECT_0) {
                CancelIoEx(dir, &ov);
                DWORD ignored;
                GetOverlappedResult(dir, &ov, &ignored, TRUE);
                break;
            }
            DWORD bytes = 0;
            if (!GetOverlappedResult(dir, &ov, &bytes, FALSE)) break;
            // Several changes usually come together (save = temporary file + replace); the window waits a
            // moment before it scans (see WM_APP_FILES in app.cpp).
            PostMessageW(window, message, 0, 0);
        }
        CloseHandle(ov.hEvent);
        CloseHandle(dir);
    });
}

void FolderWatcher::stop() {
    if (stopEvent_) SetEvent(stopEvent_);
    if (thread_.joinable()) thread_.join();
    if (stopEvent_) {
        CloseHandle(stopEvent_);
        stopEvent_ = nullptr;
    }
}

}  // namespace hse
