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

FolderWatcher::~FolderWatcher() {
    requestStop();
    join();
    if (changed_) CloseHandle(changed_);
}

void FolderWatcher::start(const std::wstring& root, HWND window, UINT message, WPARAM generation) {
    std::lock_guard lock(mutex_);
    if (stopping_) return;
    if (!changed_) {
        changed_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!changed_) return;
        thread_ = std::thread([this] { work(); });
    }
    target_ = {root, window, message, generation};
    SetEvent(changed_);
    CancelSynchronousIo(thread_.native_handle());  // the old folder may still be opening
}

void FolderWatcher::work() {
    while (WaitForSingleObject(changed_, INFINITE) == WAIT_OBJECT_0) {
        Target target;
        {
            std::lock_guard lock(mutex_);
            if (stopping_) return;
            target = target_;
            ResetEvent(changed_);
        }
        OVERLAPPED ov{};
        ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!ov.hEvent) return;
        const HANDLE waits[2] = {changed_, ov.hEvent};
        alignas(DWORD) BYTE buffer[16 * 1024];
        constexpr DWORD filter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_DIR_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_SIZE;
        do {
            const HANDLE dir = CreateFileW(target.root.c_str(), FILE_LIST_DIRECTORY, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                           nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OVERLAPPED, nullptr);
            if (dir != INVALID_HANDLE_VALUE) {
                bool first = true;
                while (WaitForSingleObject(changed_, 0) == WAIT_TIMEOUT) {
                    ResetEvent(ov.hEvent);
                    if (!ReadDirectoryChangesW(dir, buffer, sizeof buffer, TRUE, filter, nullptr, &ov, nullptr)) break;
                    // A new or recovered watch may have missed changes before it started.
                    if (first) PostMessageW(target.window, target.message, target.generation, 0);
                    first = false;
                    if (WaitForMultipleObjects(2, waits, FALSE, INFINITE) != WAIT_OBJECT_0 + 1) {
                        CancelIoEx(dir, &ov);
                        DWORD ignored;
                        GetOverlappedResult(dir, &ov, &ignored, TRUE);
                        break;
                    }
                    DWORD bytes = 0;
                    if (!GetOverlappedResult(dir, &ov, &bytes, FALSE)) break;
                    PostMessageW(target.window, target.message, target.generation, 0);  // also rescan on overflow
                }
                CloseHandle(dir);
            }
            // Retry on a disconnected share. A switch or close interrupts the wait immediately.
        } while (WaitForSingleObject(changed_, 2000) == WAIT_TIMEOUT);
        CloseHandle(ov.hEvent);
    }
}

void FolderWatcher::requestStop() {
    std::lock_guard lock(mutex_);
    stopping_ = true;
    if (changed_) SetEvent(changed_);
    if (thread_.joinable()) CancelSynchronousIo(thread_.native_handle());
}

void FolderWatcher::join() {
    if (!thread_.joinable()) return;
    while (WaitForSingleObject(thread_.native_handle(), 100) == WAIT_TIMEOUT) {
        CancelSynchronousIo(thread_.native_handle());
    }
    thread_.join();
}

}  // namespace hse
