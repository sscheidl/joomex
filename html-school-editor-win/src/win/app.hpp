// The main window with its two WebView2 views (user interface and page view) and the message bridge.
#pragma once

#include "project.hpp"
#include "winutil.hpp"
#include "../core/json.hpp"

#include <WebView2.h>
#include <wrl/client.h>

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <set>

namespace hse {

using Microsoft::WRL::ComPtr;

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
    void runLater(std::function<void()> task);   // from any thread: run on the window thread

    // project and files
    void setProject(const std::wstring& root, bool remember, std::function<void()> then = {});
    void rescan(const std::string& message = {});
    std::optional<Segments> pathSegments(const std::string& path) const;
    std::wstring boundary();
    std::optional<Segments> projectSegments(const std::wstring& file);
    void openFile(const Segments& segs, double op);
    void postOpenFailed(double op, const std::string& title = {}, const std::string& message = {});
    void save(const Segments& segs, std::string bytes, std::optional<Fingerprint> base, double id);
    void saveAs(const Segments& current, std::string bytes, std::optional<Fingerprint> base, bool createOnly, double id);
    void newPage(const Segments& segs, std::string bytes, double op);
    void pickPicture(const Segments& page, double op);
    void copyPicture(const std::string& token, const Segments& page, double op);
    void viewInBrowser(const Segments& segs);

    // page view
    void showPreview(const Segments& segs, std::string text);
    void reloadPreview();
    void onPreviewRequest(ICoreWebView2WebResourceRequestedEventArgs* args);
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
    std::wstring rootFinal_;                             // root_ as the file system resolves it (see winutil.hpp)
    FolderWatcher watcher_;
    bool scanPending_ = false;
    ULONGLONG lastScan_ = 0;
    UINT64 projectGen_ = 0;                              // counts project folders; work of an older one is dropped
    std::map<std::string, std::wstring> pictureTokens_;  // pictures outside the project waiting for a copy
    bool busy_ = false;                                  // a save runs on a worker thread

    // page view
    Segments pvSegs_;
    std::shared_ptr<const std::string> pvText_;
    std::wstring pvUrl_;
    bool pvNavigating_ = false;
    bool pvReloadAgain_ = false;
    bool pvExpectNavigation_ = false;
    std::wstring pvScroll_;                               // "[x,y]" read before a reload
    std::vector<std::pair<std::string, Json>> missing_;   // reports for the current load, by address
    UINT64 nextRequest_ = 1;
    std::map<UINT64, std::pair<ComPtr<ICoreWebView2WebResourceRequestedEventArgs>, ComPtr<ICoreWebView2Deferral>>> pending_;
};

}  // namespace hse
