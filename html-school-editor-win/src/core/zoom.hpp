// Display zoom steps of the code pane and the page pane (wish W2). One list for both views of the page (the edit
// frame and the native page view) and for the remembered levels; `ui/js/zoom.js` holds the same list, and a
// browser test compares the two.
#pragma once

#include <array>
#include <cmath>

inline constexpr std::array<int, 11> kZoomSteps{50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200};
inline constexpr int kZoomDefault = 100;

// The step nearest to `percent` (a value between two steps goes to the nearer one, a tie to the lower one);
// anything that is not a finite positive number gives the default.
inline int nearestZoomStep(double percent) {
    if (!std::isfinite(percent) || percent <= 0) return kZoomDefault;
    int best = kZoomSteps.front();
    for (int s : kZoomSteps) if (std::abs(s - percent) < std::abs(best - percent)) best = s;
    return best;
}

// One step up (dir > 0) or down (dir < 0) from the step nearest to `percent`.
inline int nextZoomStep(double percent, int dir) {
    const int now = nearestZoomStep(percent);
    for (std::size_t i = 0; i < kZoomSteps.size(); ++i) {
        if (kZoomSteps[i] != now) continue;
        if (dir > 0 && i + 1 < kZoomSteps.size()) return kZoomSteps[i + 1];
        if (dir < 0 && i > 0) return kZoomSteps[i - 1];
        return now;
    }
    return now;
}
