// The main window with its two WebView2 views (user interface and page view) and the message bridge.
#pragma once

#include "fileworkers.hpp"
#include "project.hpp"
#include "winutil.hpp"
#include "../core/json.hpp"

#include <WebView2.h>
#include <wrl/client.h>

#include <functional>
#include <map>
#include <memory>
#include <mutex>

namespace hse {

using Microsoft::WRL::ComPtr;
struct FileCache;

class App {
public:
    int run(HINSTANCE instance, int show, const std::wstring& fileToOpen);

private:
    static LRESULT CALLBACK windowProc(HWND, UINT, WPARAM, LPARAM);
    static LRESULT CALLBACK previewHostProc(HWND, UINT, WPARAM, LPARAM);
    LRESULT handle(UINT, WPARAM, LPARAM);

    // set-up
    void createEnvironment();
    void createUi();
    void createPreview();
    void layoutUi();

    // bridge
    void post(const Json& message);
    void postStatus(const std::string& text, bool warn = false);
    void postError(const std::string& title, const std::string& message);
    void onUiMessage(const Json& m);
    bool runLater(std::function<void()> task);  // from any thread; false once the window is closing
    void runWindowTask();
    void shutdown();
    void startupError(const wchar_t* message);

    // project and files
    void setProject(const std::wstring& root, bool remember, std::function<void()> then = {});
    void rescan(const std::string& message = {});
    std::optional<Segments> pathSegments(const std::string& path) const;
    void openFile(const Segments& segs, double op);
    void postOpenFailed(double op, const std::string& title = {}, const std::string& message = {});
    void save(const Segments& segs, std::string bytes, std::optional<Fingerprint> base, double id);
    void saveAs(const Segments& current, std::string bytes, std::optional<Fingerprint> base, bool createOnly, double id);
    void newPage(const Segments& segs, std::string bytes, double op);
    void pickPicture(const Segments& page, double op);
    void copyPicture(const std::string& token, const Segments& page, double op);
    void viewInBrowser(const Segments& segs);
    void rescue(const Segments& page, std::string bytes, double id);
    bool claimDialog(const Json& m);
    void refuseDialog(const Json& m);
    void endDialog();
    void noteUnsaved(const Json& m);

    // page view
    void showPreview(const Segments& segs, std::string text);
    void reloadPreview();
    void resetPreviewLoad();
    void navigatePreview(std::wstring scroll = {});
    void finishPreviewNavigation(ICoreWebView2NavigationCompletedEventArgs* args);
    void finishPreviewRequests(bool edit = false);
    void failEditView();
    void onPreviewRequest(ICoreWebView2WebResourceRequestedEventArgs* args, bool edit = false);
    // false if no response could be set (the engine would then fetch the request itself)
    bool respond(ICoreWebView2WebResourceRequestedEventArgs* args, int status, const char* reason, std::string_view contentType,
                 std::shared_ptr<const std::string> body, const char* csp = nullptr);
    void failPreview();
    void reportMissing(const std::string& address, const char* reason, const std::string& detail);
    void sendMissing();
    void onUiRequest(ICoreWebView2WebResourceRequestedEventArgs* args);

    HINSTANCE instance_ = nullptr;
    HWND window_ = nullptr;
    HWND previewHost_ = nullptr;
    std::wstring startFile_;
    std::shared_ptr<int> callbackLifetime_ = std::make_shared<int>(0);
    std::mutex taskMutex_;
    std::deque<std::function<void()>> windowTasks_;
    HWND taskWindow_ = nullptr;  // protected by taskMutex_
    bool runningWindowTask_ = false;
    FileWorkers fileWorkers_{2, 32};
    FileWorkers previewWorkers_{4, 96};
    FileWorkers editWorkers_{2, 48};
    // Rescue copies go to the local disk on their own thread, so a hanging network drive that holds every
    // file worker cannot stop them.
    FileWorkers rescueWorkers_{1, 4};

    ComPtr<ICoreWebView2Environment> env_;
    ComPtr<ICoreWebView2Controller> uiController_;
    ComPtr<ICoreWebView2> ui_;
    ComPtr<ICoreWebView2Controller> pvController_;
    ComPtr<ICoreWebView2> pv_;
    bool uiReady_ = false;
    bool closing_ = false;
    RECT pvRect_{};
    bool pvVisible_ = false;

    // project
    std::wstring root_;
    std::shared_ptr<ProjectBoundary> boundary_;          // root_ as the file system resolves it; one per project folder
    bool unsaved_ = false;                               // the interface holds text that could be lost
    bool pageOpen_ = false;                              // the interface has a page open
    bool endBlocked_ = false;                            // a shutdown block reason is set
    FolderWatcher watcher_;
    bool scanPending_ = false;
    ULONGLONG lastScan_ = 0;
    UINT64 projectGen_ = 0;                              // counts project folders; work of an older one is dropped
    UINT64 scanGen_ = 0;
    std::map<std::string, std::wstring> pictureTokens_;  // pictures outside the project waiting for a copy
    bool busy_ = false;                                  // a save runs on a worker thread
    bool dialogBusy_ = false;                            // a file dialog was asked for and has not closed yet
    double openOp_ = 0;                                  // the latest request to open a page (openDialog, openFile, newPage)

    // page view
    Segments pvSegs_;
    std::shared_ptr<const std::string> pvText_;
    struct PreviewStart {
        UINT64 generation;
        std::wstring url;
        std::wstring scroll;
    };
    UINT64 pvGeneration_ = 0;
    std::optional<PreviewStart> pvStart_;
    std::optional<UINT64> pvNavigationId_;
    std::shared_ptr<FileCache> pvCache_;
    std::shared_ptr<FileCache> editCache_;
    bool pvReadingScroll_ = false;
    bool pvReloadAgain_ = false;
    bool pvFailed_ = false;
    bool editFailed_ = false;
    std::wstring pvScroll_;                               // "[x,y]" read before a reload
    std::vector<std::pair<std::string, Json>> missing_;   // reports for the current load, by address
    UINT64 nextRequest_ = 1;
    struct PreviewRequest {
        UINT64 generation;
        ComPtr<ICoreWebView2WebResourceRequestedEventArgs> args;
        ComPtr<ICoreWebView2Deferral> deferral;
    };
    std::map<UINT64, PreviewRequest> pending_;
    std::map<UINT64, PreviewRequest> editPending_;
};

}  // namespace hse
