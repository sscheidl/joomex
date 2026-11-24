// The project folder: list of pages, style sheets and pictures, and a watcher for changes.
#pragma once

#include "winutil.hpp"

#include <atomic>
#include <thread>

namespace hse {

struct ProjectEntry {
    Segments segs;
    FileKind kind;
};

// Lists pages, style sheets and pictures below `root` (hidden and system entries, and folders whose name
// begins with '.', are left out). At most 8 folder levels and 3000 entries. Runs on any thread.
std::vector<ProjectEntry> scanProject(const std::wstring& root);

// Watches `root` and its subfolders and posts `message` to `window` after a change. Network drives may not
// support this; the caller scans again when the window is activated anyway.
class FolderWatcher {
public:
    FolderWatcher() = default;
    ~FolderWatcher() { stop(); }
    FolderWatcher(const FolderWatcher&) = delete;
    FolderWatcher& operator=(const FolderWatcher&) = delete;

    void start(const std::wstring& root, HWND window, UINT message);
    void stop();

private:
    HANDLE stopEvent_ = nullptr;
    std::thread thread_;
};

}  // namespace hse
