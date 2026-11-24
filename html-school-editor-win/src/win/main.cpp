// Entry point. Optional argument: an .html file to open (its folder becomes the project folder).
#include "app.hpp"

#include <objbase.h>
#include <shellapi.h>

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
    if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE))) return 1;
    std::wstring file;
    int argc = 0;
    if (LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc)) {
        if (argc > 1) {
            wchar_t full[4096];
            const DWORD n = GetFullPathNameW(argv[1], 4096, full, nullptr);
            if (n > 0 && n < 4096 && hse::isFile(full) && hse::kindOf(hse::toUtf8(hse::lastComponent(full))) == hse::FileKind::Page) file = full;
        }
        LocalFree(argv);
    }
    int result;
    {
        hse::App app;
        result = app.run(instance, show, file);
    }
    CoUninitialize();
    return result;
}
