cmake_minimum_required(VERSION 3.21)
project(HtmlSchoolEditorWin VERSION 0.1.0 LANGUAGES CXX)

# The full version with its pre-release label; every exe that leaves the repository has its own.
set(HSE_VERSION "0.1.0-alpha.13")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")  # no VC++ runtime needed on school computers

option(HSE_TEST_HOOKS "Test build: DevTools and the debugging port from HSE_DEBUG_PORT (never for pupils)" OFF)

# ---------------------------------------------------------------- portable core and its tests

add_library(hse_core STATIC src/core/json.cpp src/core/paths.cpp)
target_include_directories(hse_core PUBLIC src/core)
if(MSVC)
  target_compile_options(hse_core PRIVATE /W4 /permissive- /utf-8)
else()
  target_compile_options(hse_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

enable_testing()
add_executable(core_tests tests/core/core_tests.cpp)
target_link_libraries(core_tests PRIVATE hse_core)
if(MSVC)
  target_compile_options(core_tests PRIVATE /W4 /permissive- /utf-8)
endif()
add_test(NAME core_tests COMMAND core_tests)

if(NOT WIN32)
  message(STATUS "Not Windows: only the portable core and its tests are built.")
  return()
endif()

# ---------------------------------------------------------------- WebView2 SDK (tools/fetch-webview2.ps1)

set(WEBVIEW2_DIR "${CMAKE_SOURCE_DIR}/third_party/webview2" CACHE PATH "Unpacked Microsoft.Web.WebView2 NuGet package")
if(NOT EXISTS "${WEBVIEW2_DIR}/build/native/include/WebView2.h")
  message(FATAL_ERROR "WebView2 SDK not found in ${WEBVIEW2_DIR}. Run: powershell -ExecutionPolicy Bypass -File tools\\fetch-webview2.ps1")
endif()
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(WEBVIEW2_ARCH x64)
else()
  set(WEBVIEW2_ARCH x86)
endif()

# ---------------------------------------------------------------- user interface as resources (ui/resources.json)

set(GEN "${CMAKE_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${GEN}")
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${CMAKE_SOURCE_DIR}/ui/resources.json")
file(READ "${CMAKE_SOURCE_DIR}/ui/resources.json" UI_JSON)
string(JSON UI_FILES GET "${UI_JSON}" files)
string(JSON UI_COUNT LENGTH "${UI_FILES}")
math(EXPR UI_LAST "${UI_COUNT} - 1")
set(UI_RC "#pragma code_page(65001)\n")
set(UI_INC "")
set(UI_DEPS "")
foreach(I RANGE ${UI_LAST})
  string(JSON KEY MEMBER "${UI_FILES}" ${I})
  string(JSON SRC GET "${UI_FILES}" "${KEY}")
  get_filename_component(ABS "${SRC}" ABSOLUTE BASE_DIR "${CMAKE_SOURCE_DIR}")
  if(NOT EXISTS "${ABS}")
    message(FATAL_ERROR "ui/resources.json names a missing file: ${SRC}")
  endif()
  file(TO_NATIVE_PATH "${ABS}" NATIVE)
  string(REPLACE "\\" "\\\\" NATIVE "${NATIVE}")
  get_filename_component(EXT "${ABS}" LAST_EXT)
  if(EXT STREQUAL ".html")
    set(CT "text/html; charset=utf-8")
  elseif(EXT STREQUAL ".css")
    set(CT "text/css; charset=utf-8")
  elseif(EXT STREQUAL ".js")
    set(CT "text/javascript; charset=utf-8")
  else()
    set(CT "application/octet-stream")
  endif()
  string(APPEND UI_RC "UI_RES_${I} RCDATA \"${NATIVE}\"\n")
  string(APPEND UI_INC "{L\"${KEY}\", L\"UI_RES_${I}\", \"${CT}\"},\n")
  list(APPEND UI_DEPS "${ABS}")
endforeach()
file(WRITE "${GEN}/ui_resources.rc" "${UI_RC}")
file(WRITE "${GEN}/ui_resources.inc" "${UI_INC}")
set_source_files_properties("${GEN}/ui_resources.rc" PROPERTIES OBJECT_DEPENDS "${UI_DEPS}")
configure_file(src/win/app.rc.in "${GEN}/app.rc" @ONLY)

# ---------------------------------------------------------------- the program

add_executable(HtmlSchulEditor WIN32
  src/win/main.cpp
  src/win/app.cpp
  src/win/winutil.cpp
  src/win/project.cpp
  src/win/app.manifest
  "${GEN}/app.rc"
  "${GEN}/ui_resources.rc")
target_include_directories(HtmlSchulEditor PRIVATE "${GEN}" "${WEBVIEW2_DIR}/build/native/include")
target_compile_definitions(HtmlSchulEditor PRIVATE UNICODE _UNICODE NOMINMAX HSE_VERSION="${HSE_VERSION}"
  $<$<BOOL:${HSE_TEST_HOOKS}>:HSE_TEST_HOOKS>)
target_compile_options(HtmlSchulEditor PRIVATE /W4 /permissive- /utf-8 /EHsc)
target_link_libraries(HtmlSchulEditor PRIVATE hse_core
  "${WEBVIEW2_DIR}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib"
  shlwapi shell32 ole32 advapi32 user32 version)
