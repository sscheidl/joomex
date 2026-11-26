// The project folder: list of pages, style sheets and pictures, and a watcher for changes.
#pragma once

#include "winutil.hpp"

#include <mutex>
#include <thread>

namespace hse {

struct ProjectEntry {
    Segments segs;
    FileKind kind;
};

// Lists pages, style sheets and pictures below `root` (hidden and system entries, and folders whose name
// begins with '.', are left out). At most 8 folder levels and 3000 entries. Runs on any thread.
std::vector<ProjectEntry> scanProject(const std::wstring& root);

// Watches the current project on one thread. The window can change the target without waiting
// for the old share. Notifications carry the project generation in WPARAM.
class FolderWatcher {
public:
    FolderWatcher() = default;
    ~FolderWatcher();
    FolderWatcher(const FolderWatcher&) = delete;
    FolderWatcher& operator=(const FolderWatcher&) = delete;

    void start(const std::wstring& root, HWND window, UINT message, WPARAM generation);
    void requestStop();
    void join();

private:
    struct Target {
        std::wstring root;
        HWND window = nullptr;
        UINT message = 0;
        WPARAM generation = 0;
    };
    void work();

    std::mutex mutex_;
    Target target_;
    bool stopping_ = false;
    HANDLE changed_ = nullptr;
    std::thread thread_;
};

}  // namespace hse
