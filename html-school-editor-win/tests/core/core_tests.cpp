// Unit tests of the portable core. Run: build target core_tests (CMake) or, on any platform,
//   c++ -std=c++20 -Isrc/core src/core/*.cpp tests/core/core_tests.cpp -o core_tests && ./core_tests
#include <cmath>
#include <cstdio>
#include <string>

#include "json.hpp"
#include "paths.hpp"
#include "zoom.hpp"

using namespace hse;

static int failures = 0, checks = 0;
#define CHECK(cond) do { ++checks; if (!(cond)) { ++failures; std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); } } while (0)
#define CHECK_EQ(a, b) do { ++checks; const auto va = (a); const auto vb = (b); if (!(va == vb)) { ++failures; std::printf("FAIL %s:%d: %s == %s\n", __FILE__, __LINE__, #a, #b); } } while (0)

static Segments S(std::initializer_list<const char*> l) { Segments s; for (auto* x : l) s.emplace_back(x); return s; }

static void testRequestSegments() {
    CHECK_EQ(*requestSegments("/katze.png"), S({"katze.png"}));
    CHECK_EQ(*requestSegments("/bilder/tiere/katze.png"), S({"bilder", "tiere", "katze.png"}));
    CHECK_EQ(*requestSegments("/Meine%20Katze.png"), S({"Meine Katze.png"}));
    CHECK_EQ(*requestSegments("/K%C3%A4tzchen.png"), S({"K\xC3\xA4tzchen.png"}));
    CHECK_EQ(*requestSegments("/K\xC3\xA4tzchen.png"), S({"K\xC3\xA4tzchen.png"}));
    CHECK_EQ(*requestSegments("/a%23b.png"), S({"a#b.png"}));
    CHECK_EQ(*requestSegments("/100%.png"), S({"100%.png"}));           // a lone % stays
    CHECK(!requestSegments(""));
    CHECK(!requestSegments("/"));
    CHECK(!requestSegments("katze.png"));
    CHECK(!requestSegments("/a//b.png"));
    CHECK(!requestSegments("/../x.png"));
    CHECK(!requestSegments("/a/%2E%2E/x.png"));
    CHECK(!requestSegments("/a%2Fb.png"));
    CHECK(!requestSegments("/a%5Cb.png"));
    CHECK(!requestSegments("/C:/x.png"));
    CHECK(!requestSegments("/datei.txt:stream"));
    CHECK(!requestSegments("/con.png"));
    CHECK(!requestSegments("/COM1"));
    CHECK(!requestSegments("/x.png."));
    CHECK(!requestSegments("/x.png%20"));
    CHECK(!requestSegments("/a%00b"));
    CHECK(!requestSegments("/%C3%28.png"));                             // invalid UTF-8
    CHECK(requestSegments("/console.png").has_value());                 // only exact device names
}

static void testPathOfUrl() {
    const char* o = "https://projekt.example";
    CHECK_EQ(*pathOfUrl("https://projekt.example/a/b.png?x=1#y", o), std::string("/a/b.png"));
    CHECK_EQ(*pathOfUrl("HTTPS://Projekt.Example/a.html", o), std::string("/a.html"));
    CHECK_EQ(*pathOfUrl("https://projekt.example", o), std::string("/"));
    CHECK(!pathOfUrl("https://projekt.example.evil/a.png", o));
    CHECK(!pathOfUrl("https://projekt.example:8080/a.png", o));
    CHECK(!pathOfUrl("https://example.org/a.png", o));
    CHECK(!pathOfUrl("file:///C:/a.png", o));
}

static void testUrlPathRoundTrip() {
    const auto segments = S({"Übungen", "Grüße #1", "100% Süß.html"});
    const std::string encoded = urlPathOf(segments);
    CHECK_EQ(encoded, std::string("/%C3%9Cbungen/Gr%C3%BC%C3%9Fe%20%231/100%25%20S%C3%BC%C3%9F.html"));
    CHECK_EQ(requestSegments(encoded), std::optional{segments});
    CHECK_EQ(requestSegments(urlPathOf(S({"%C3%A4.html"}))), std::optional{S({"%C3%A4.html"})});

    std::string longSegment;
    for (int i = 0; i < 90; ++i) longSegment += "ä";
    const Segments longPath(8, longSegment);
    CHECK_EQ(requestSegments(urlPathOf(longPath)), std::optional{longPath});
    CHECK(!requestSegments(urlPathOf(Segments(12, longSegment))));
}

static void testRelativeAddress() {
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"katze.png"})), std::string("katze.png"));
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"bilder", "katze.png"})), std::string("bilder/katze.png"));
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"bilder", "tiere", "katze.png"})), std::string("bilder/tiere/katze.png"));
    CHECK_EQ(relativeAddress(S({"seiten", "tiere.html"}), S({"bilder", "katze.png"})), std::string("../bilder/katze.png"));
    CHECK_EQ(relativeAddress(S({"seiten", "tiere.html"}), S({"seiten", "katze.png"})), std::string("katze.png"));
    CHECK_EQ(relativeAddress(S({"a", "b", "c.html"}), S({"x.png"})), std::string("../../x.png"));
    CHECK_EQ(relativeAddress(S({"a", "b", "c.html"}), S({"a", "x", "y.png"})), std::string("../x/y.png"));
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"Meine Bilder", "a#b?.png"})), std::string("Meine%20Bilder/a%23b%3F.png"));
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"K\xC3\xA4tzchen.png"})), std::string("K%C3%A4tzchen.png"));
    CHECK_EQ(relativeAddress(S({"index.html"}), S({"100%.png"})), std::string("100%25.png"));
}

static void testCaseAndKinds() {
    CHECK(differsOnlyInCase("Katze.png", "katze.png"));
    CHECK(differsOnlyInCase("\xC3\x84pfel.PNG", "\xC3\xA4pfel.png"));        // Äpfel / äpfel
    CHECK(!differsOnlyInCase("katze.png", "katze.png"));
    CHECK(!differsOnlyInCase("katze.png", "katze.jpg"));
    CHECK(kindOf("index.HTML") == FileKind::Page);
    CHECK(kindOf("stil.css") == FileKind::Style);
    CHECK(kindOf("foto.JPEG") == FileKind::Picture);
    CHECK(kindOf("foto.heic") == FileKind::Other);
    CHECK(kindOf(".htaccess") == FileKind::Other);
    CHECK_EQ(std::string(contentTypeOf("a.SVG")), std::string("image/svg+xml"));
    CHECK_EQ(std::string(contentTypeOf("a.html")), std::string("text/html; charset=utf-8"));
    CHECK_EQ(std::string(contentTypeOf("a.exe")), std::string("application/octet-stream"));
}

static void testUniqueAndFingerprint() {
    CHECK_EQ(uniqueName("katze.png", {}), std::string("katze.png"));
    CHECK_EQ(uniqueName("katze.png", {"KATZE.PNG"}), std::string("katze-2.png"));
    CHECK_EQ(uniqueName("katze.png", {"katze.png", "katze-2.png"}), std::string("katze-3.png"));
    CHECK_EQ(uniqueName("README", {"readme"}), std::string("README-2"));
    CHECK(fingerprintOf("abc") == fingerprintOf("abc"));
    CHECK(!(fingerprintOf("abc") == fingerprintOf("abd")));
    CHECK_EQ(fingerprintOf("").size, 0u);
    CHECK_EQ(fingerprintText(Fingerprint{3, 0x0123456789abcdefULL}), std::string("3-0123456789abcdef"));
    CHECK_EQ(fingerprintText(Fingerprint{0, 0}), std::string("0-0000000000000000"));
    CHECK(*parseFingerprint(fingerprintText(fingerprintOf("abc"))) == fingerprintOf("abc"));
    CHECK(*parseFingerprint("18446744073709551615-ffffffffffffffff") == (Fingerprint{UINT64_MAX, UINT64_MAX}));
    CHECK(!parseFingerprint(""));
    CHECK(!parseFingerprint("3"));
    CHECK(!parseFingerprint("-0123456789abcdef"));
    CHECK(!parseFingerprint("3-0123456789abcde"));     // 15 hex digits
    CHECK(!parseFingerprint("3-0123456789ABCDEF"));    // upper case is not what fingerprintText writes
    CHECK(!parseFingerprint("x-0123456789abcdef"));
    CHECK(!parseFingerprint("18446744073709551616-0000000000000000"));  // size overflows
    CHECK_EQ(base64Encode(""), std::string(""));
    CHECK_EQ(base64Encode("f"), std::string("Zg=="));
    CHECK_EQ(base64Encode("fo"), std::string("Zm8="));
    CHECK_EQ(base64Encode("foo"), std::string("Zm9v"));
    CHECK_EQ(base64Encode(std::string("\xEF\xBB\xBF<p>", 6)), std::string("77u/PHA+"));
}

static void testJson() {
    auto j = Json::parse(R"({"type":"save","rev":12,"text":"a\"b\\c\n\u00e4\ud83d\ude00","ok":true,"list":[1,null,"x"]})");
    CHECK(j.has_value());
    CHECK_EQ(j->at("type").str(), std::string("save"));
    CHECK_EQ(j->at("rev").num(), 12.0);
    CHECK_EQ(j->at("text").str(), std::string("a\"b\\c\n\xC3\xA4\xF0\x9F\x98\x80"));
    CHECK(j->at("ok").boolean());
    CHECK_EQ(j->at("list").size(), 3u);
    CHECK(j->at("list")[1].isNull());
    CHECK(j->at("missing").isNull());
    CHECK_EQ(j->at("missing").str(), std::string(""));
    CHECK(!Json::parse("{\"a\":1} x"));
    CHECK(!Json::parse("{\"a\":}"));
    CHECK(!Json::parse("\"\\ud800\""));                 // lone surrogate
    CHECK(!Json::parse("\"\xC3\x28\""));                 // invalid UTF-8
    CHECK(!Json::parse("\"a\nb\""));                      // raw control character
    CHECK(!Json::parse("01"));
    std::string deep(70, '['); deep += std::string(70, ']');
    CHECK(!Json::parse(deep));
    Json o = Json::object();
    o.set("type", "opened");
    o.set("n", 3);
    o.set("s", std::string("\xC3\xA4\x01\"</"));
    CHECK_EQ(o.dump(), std::string("{\"n\":3,\"s\":\"\xC3\xA4\\u0001\\\"</\",\"type\":\"opened\"}"));
    CHECK_EQ(Json::object().set("b", 2).set("a", "x").set("l", Json::array().push(1).push(true)).dump(), std::string("{\"a\":\"x\",\"b\":2,\"l\":[1,true]}"));
    auto back = Json::parse(o.dump());
    CHECK(back && back->at("s").str() == "\xC3\xA4\x01\"</");
}

// The zoom steps of both page views and of the remembered levels (review of alpha.20, finding 3).
static void testZoomSteps() {
    CHECK(nearestZoomStep(100) == 100);
    CHECK(nearestZoomStep(144) == 150);   // an engine level between two steps goes to the nearer step
    CHECK(nearestZoomStep(137.5) == 125); // a tie goes to the lower step
    CHECK(nearestZoomStep(66.67) == 67);
    CHECK(nearestZoomStep(33) == 50);
    CHECK(nearestZoomStep(250) == 200);
    CHECK(nearestZoomStep(0) == 100);
    CHECK(nearestZoomStep(-5) == 100);
    CHECK(nearestZoomStep(std::nan("")) == 100);
    CHECK(nextZoomStep(100, 1) == 110);
    CHECK(nextZoomStep(100, -1) == 90);
    CHECK(nextZoomStep(144, 1) == 175);
    CHECK(nextZoomStep(200, 1) == 200);
    CHECK(nextZoomStep(50, -1) == 50);
}

int main() {
    testRequestSegments();
    testPathOfUrl();
    testUrlPathRoundTrip();
    testRelativeAddress();
    testCaseAndKinds();
    testUniqueAndFingerprint();
    testJson();
    testZoomSteps();
    std::printf("%d checks, %d failed\n", checks, failures);
    return failures ? 1 : 0;
}
