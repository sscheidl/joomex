#include "winutil.hpp"

#include <knownfolders.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <wrl/client.h>

#include <algorithm>
#include <cstdio>
#include <random>

using Microsoft::WRL::ComPtr;

namespace hse {

std::wstring toWide(std::string_view utf8) {
    if (utf8.empty()) return {};
    const int n = MultiByteToWideChar(CP_UTF8, 0, utf8.data(), static_cast<int>(utf8.size()), nullptr, 0);
    std::wstring out(static_cast<std::size_t>(n), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.data(), static_cast<int>(utf8.size()), out.data(), n);
    return out;
}

std::string toUtf8(std::wstring_view wide) {
    if (wide.empty()) return {};
    const int n = WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()), nullptr, 0, nullptr, nullptr);
    std::string out(static_cast<std::size_t>(n), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()), out.data(), n, nullptr, nullptr);
    return out;
}

// ---------------------------------------------------------------- files

namespace {

struct Handle {
    HANDLE h = INVALID_HANDLE_VALUE;
    explicit Handle(HANDLE x) : h(x) {}
    ~Handle() { if (h != INVALID_HANDLE_VALUE && h != nullptr) CloseHandle(h); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    bool ok() const { return h != INVALID_HANDLE_VALUE && h != nullptr; }
};

DWORD writeAll(HANDLE h, std::string_view bytes) {
    std::size_t at = 0;
    while (at < bytes.size()) {
        const DWORD chunk = static_cast<DWORD>(std::min<std::size_t>(bytes.size() - at, 1u << 20));
        DWORD written = 0;
        if (!WriteFile(h, bytes.data() + at, chunk, &written, nullptr)) return GetLastError();
        if (written == 0) return ERROR_WRITE_FAULT;
        at += written;
    }
    if (!FlushFileBuffers(h)) return GetLastError();
    return ERROR_SUCCESS;
}

}  // namespace

ReadResult readFileBytes(const std::wstring& path, std::size_t maxBytes) {
    ReadResult r;
    Handle f(CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr));
    if (!f.ok()) { r.error = GetLastError(); return r; }
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(f.h, &size)) { r.error = GetLastError(); return r; }
    if (size.QuadPart < 0 || static_cast<unsigned long long>(size.QuadPart) > maxBytes) { r.error = ERROR_FILE_TOO_LARGE; return r; }
    r.bytes.resize(static_cast<std::size_t>(size.QuadPart));
    std::size_t at = 0;
    while (at < r.bytes.size()) {
        DWORD got = 0;
        const DWORD want = static_cast<DWORD>(std::min<std::size_t>(r.bytes.size() - at, 1u << 20));
        if (!ReadFile(f.h, r.bytes.data() + at, want, &got, nullptr)) { r.error = GetLastError(); r.bytes.clear(); return r; }
        if (got == 0) break;  // the file became shorter while reading
        at += got;
    }
    r.bytes.resize(at);
    return r;
}

DWORD writeFileAtomic(const std::wstring& path, std::string_view bytes) {
    const std::wstring folder = parentOf(path);
    std::random_device rd;
    wchar_t suffix[32];
    swprintf_s(suffix, L".~hse-%08x.tmp", rd());
    const std::wstring temp = folder + L"\\" + lastComponent(path) + suffix;
    {
        Handle f(CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr));
        if (!f.ok()) return GetLastError();
        const DWORD e = writeAll(f.h, bytes);
        if (e != ERROR_SUCCESS) {
            CloseHandle(f.h);
            f.h = INVALID_HANDLE_VALUE;
            DeleteFileW(temp.c_str());
            return e;
        }
    }
    BOOL done;
    if (isFile(path)) {
        done = ReplaceFileW(path.c_str(), temp.c_str(), nullptr, REPLACEFILE_IGNORE_MERGE_ERRORS | REPLACEFILE_IGNORE_ACL_ERRORS, nullptr, nullptr);
    } else {
        done = MoveFileExW(temp.c_str(), path.c_str(), MOVEFILE_WRITE_THROUGH);
    }
    if (!done) {
        const DWORD e = GetLastError();
        DeleteFileW(temp.c_str());
        return e;
    }
    return ERROR_SUCCESS;
}

DWORD createNewFile(const std::wstring& path, std::string_view bytes) {
    Handle f(CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr));
    if (!f.ok()) return GetLastError();
    const DWORD e = writeAll(f.h, bytes);
    if (e != ERROR_SUCCESS) {
        CloseHandle(f.h);
        f.h = INVALID_HANDLE_VALUE;
        DeleteFileW(path.c_str());
    }
    return e;
}

DWORD createFolders(const std::wstring& folder) {
    if (folder.empty() || isFolder(folder)) return ERROR_SUCCESS;
    const std::wstring parent = parentOf(folder);
    if (!parent.empty() && parent != folder) {
        const DWORD e = createFolders(parent);
        if (e != ERROR_SUCCESS) return e;
    }
    if (!CreateDirectoryW(folder.c_str(), nullptr)) {
        const DWORD e = GetLastError();
        if (e != ERROR_ALREADY_EXISTS) return e;
    }
    return ERROR_SUCCESS;
}

bool isFolder(const std::wstring& path) {
    const DWORD a = GetFileAttributesW(path.c_str());
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
}

bool isFile(const std::wstring& path) {
    const DWORD a = GetFileAttributesW(path.c_str());
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

std::optional<std::wstring> actualName(const std::wstring& path) {
    WIN32_FIND_DATAW fd;
    const HANDLE h = FindFirstFileExW(path.c_str(), FindExInfoBasic, &fd, FindExSearchNameMatch, nullptr, 0);
    if (h == INVALID_HANDLE_VALUE) return std::nullopt;
    FindClose(h);
    return std::wstring(fd.cFileName);
}

std::string errorText(DWORD e) {
    switch (e) {
        case ERROR_ACCESS_DENIED:
        case ERROR_UNABLE_TO_REMOVE_REPLACED:
            return "Der Editor darf hier nicht schreiben. Vielleicht ist die Datei schreibgeschützt oder du hast in diesem Ordner keine Schreibrechte.";
        case ERROR_SHARING_VIOLATION:
        case ERROR_LOCK_VIOLATION:
        case ERROR_USER_MAPPED_FILE:
            return "Die Datei ist gerade in einem anderen Programm geöffnet. Schließe es und versuche es noch einmal.";
        case ERROR_DISK_FULL:
        case ERROR_HANDLE_DISK_FULL:
            return "Auf dem Laufwerk ist kein Platz mehr frei.";
        case ERROR_BAD_NETPATH:
        case ERROR_BAD_NET_NAME:
        case ERROR_NETNAME_DELETED:
        case ERROR_UNEXP_NET_ERR:
        case ERROR_NETWORK_UNREACHABLE:
        case ERROR_SEM_TIMEOUT:
        case ERROR_DEV_NOT_EXIST:
            return "Die Verbindung zum Netzlaufwerk ist unterbrochen.";
        case ERROR_FILE_NOT_FOUND:
        case ERROR_PATH_NOT_FOUND:
            return "Die Datei oder der Ordner wurde nicht gefunden.";
        case ERROR_FILE_EXISTS:
        case ERROR_ALREADY_EXISTS:
            return "Eine Datei mit diesem Namen gibt es schon.";
        case ERROR_FILE_TOO_LARGE:
            return "Die Datei ist zu groß.";
        case ERROR_WRITE_PROTECT:
            return "Das Laufwerk ist schreibgeschützt.";
        default: {
            char buf[64];
            sprintf_s(buf, "Windows meldet den Fehler %lu.", static_cast<unsigned long>(e));
            return buf;
        }
    }
}

std::wstring parentOf(const std::wstring& path) {
    const auto cut = path.find_last_of(L"\\/");
    if (cut == std::wstring::npos) return {};
    if (cut == 2 && path.size() > 2 && path[1] == L':') return path.substr(0, 3);  // "C:\"
    return path.substr(0, cut);
}

std::wstring lastComponent(const std::wstring& path) {
    std::wstring p = path;
    while (p.size() > 1 && (p.back() == L'\\' || p.back() == L'/')) p.pop_back();
    const auto cut = p.find_last_of(L"\\/");
    return cut == std::wstring::npos ? p : p.substr(cut + 1);
}

std::wstring joinPath(const std::wstring& folder, const Segments& segs) {
    std::wstring out = folder;
    for (const auto& s : segs) {
        if (out.empty() || (out.back() != L'\\' && out.back() != L'/')) out += L'\\';
        out += toWide(s);
    }
    return out;
}

std::optional<Segments> segmentsBelow(const std::wstring& root, const std::wstring& path) {
    std::wstring r = root;
    while (!r.empty() && (r.back() == L'\\' || r.back() == L'/')) r.pop_back();
    if (path.size() <= r.size() + 1) return std::nullopt;
    if (CompareStringOrdinal(path.c_str(), static_cast<int>(r.size()), r.c_str(), static_cast<int>(r.size()), TRUE) != CSTR_EQUAL) return std::nullopt;
    if (path[r.size()] != L'\\' && path[r.size()] != L'/') return std::nullopt;
    Segments segs;
    std::size_t at = r.size() + 1;
    while (at <= path.size()) {
        const std::size_t cut = path.find_first_of(L"\\/", at);
        const std::wstring part = path.substr(at, cut == std::wstring::npos ? std::wstring::npos : cut - at);
        if (part.empty() || part == L"." || part == L"..") return std::nullopt;
        segs.push_back(toUtf8(part));
        if (cut == std::wstring::npos) break;
        at = cut + 1;
    }
    return segs;
}

// ---------------------------------------------------------------- dialogs

namespace {

void startIn(IFileDialog* d, const std::wstring& start) {
    if (start.empty()) return;
    ComPtr<IShellItem> item;
    if (SUCCEEDED(SHCreateItemFromParsingName(start.c_str(), nullptr, IID_PPV_ARGS(&item)))) d->SetFolder(item.Get());
}

std::optional<std::wstring> resultPath(IFileDialog* d) {
    ComPtr<IShellItem> item;
    if (FAILED(d->GetResult(&item))) return std::nullopt;
    PWSTR p = nullptr;
    if (FAILED(item->GetDisplayName(SIGDN_FILESYSPATH, &p)) || !p) return std::nullopt;
    std::wstring out(p);
    CoTaskMemFree(p);
    return out;
}

std::optional<std::wstring> openDialog(HWND owner, const std::wstring& start, const wchar_t* title, FILEOPENDIALOGOPTIONS extra,
                                       const COMDLG_FILTERSPEC* filters, UINT filterCount) {
    ComPtr<IFileOpenDialog> d;
    if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&d)))) return std::nullopt;
    FILEOPENDIALOGOPTIONS o = 0;
    d->GetOptions(&o);
    d->SetOptions(o | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | extra);
    d->SetTitle(title);
    if (filterCount) d->SetFileTypes(filterCount, filters);
    startIn(d.Get(), start);
    if (FAILED(d->Show(owner))) return std::nullopt;
    return resultPath(d.Get());
}

}  // namespace

std::optional<std::wstring> pickFolder(HWND owner, const std::wstring& start) {
    return openDialog(owner, start, L"Projektordner wählen", FOS_PICKFOLDERS, nullptr, 0);
}

std::optional<std::wstring> pickPageFile(HWND owner, const std::wstring& start) {
    static const COMDLG_FILTERSPEC f[] = {{L"Webseiten (*.html, *.htm)", L"*.html;*.htm"}};
    return openDialog(owner, start, L"Seite öffnen", FOS_FILEMUSTEXIST, f, 1);
}

std::optional<std::wstring> pickPictureFile(HWND owner, const std::wstring& start) {
    static const COMDLG_FILTERSPEC f[] = {
        {L"Bilder (*.png, *.jpg, *.gif, *.webp, *.svg)", L"*.png;*.jpg;*.jpeg;*.jfif;*.gif;*.webp;*.svg;*.bmp;*.ico;*.avif"},
        {L"Alle Dateien", L"*.*"},
    };
    return openDialog(owner, start, L"Bild einfügen", FOS_FILEMUSTEXIST, f, 2);
}

std::optional<std::wstring> pickSaveFile(HWND owner, const std::wstring& start, const std::wstring& name) {
    ComPtr<IFileSaveDialog> d;
    if (FAILED(CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&d)))) return std::nullopt;
    static const COMDLG_FILTERSPEC f[] = {{L"Webseite (*.html)", L"*.html;*.htm"}};
    FILEOPENDIALOGOPTIONS o = 0;
    d->GetOptions(&o);
    d->SetOptions(o | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_OVERWRITEPROMPT);
    d->SetTitle(L"Speichern unter");
    d->SetFileTypes(1, f);
    d->SetDefaultExtension(L"html");
    d->SetFileName(name.c_str());
    startIn(d.Get(), start);
    if (FAILED(d->Show(owner))) return std::nullopt;
    return resultPath(d.Get());
}

// ---------------------------------------------------------------- settings

namespace {
constexpr const wchar_t* kKey = L"Software\\HtmlSchoolEditor";
}

std::wstring readSetting(const wchar_t* name) {
    wchar_t buf[2048];
    DWORD size = sizeof(buf);
    if (RegGetValueW(HKEY_CURRENT_USER, kKey, name, RRF_RT_REG_SZ, nullptr, buf, &size) != ERROR_SUCCESS) return {};
    return buf;
}

void writeSetting(const wchar_t* name, const std::wstring& value) {
    HKEY key;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, kKey, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &key, nullptr) != ERROR_SUCCESS) return;
    RegSetValueExW(key, name, 0, REG_SZ, reinterpret_cast<const BYTE*>(value.c_str()), static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(key);
}

std::wstring localDataFolder(const wchar_t* sub) {
    PWSTR base = nullptr;
    std::wstring out;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &base)) && base) {
        out = std::wstring(base) + L"\\HtmlSchoolEditor\\" + sub;
        CoTaskMemFree(base);
        if (createFolders(out) == ERROR_SUCCESS) return out;
    } else if (base) {
        CoTaskMemFree(base);
    }
    wchar_t temp[MAX_PATH + 1];
    const DWORD n = GetTempPathW(MAX_PATH + 1, temp);
    out = std::wstring(temp, n) + L"HtmlSchoolEditor\\" + sub;
    createFolders(out);
    return out;
}

}  // namespace hse
