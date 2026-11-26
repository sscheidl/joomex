// Bounded workers for synchronous file I/O. Only the window thread submits jobs or requests shutdown.
#pragma once

#include <windows.h>

#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

namespace hse {

class FileWorkers {
public:
    FileWorkers(std::size_t threads, std::size_t queueLimit) : workers_(threads), limit_(queueLimit) {
        try {
            for (auto& worker : workers_) worker.thread = std::thread([this, &worker] { work(worker); });
        } catch (...) {
            stop();
            join();
            throw;
        }
    }

    ~FileWorkers() { stop(); join(); }

    // A write accepted before closing is allowed to finish. Read jobs can be dropped or cancelled.
    bool submit(std::function<void()> task, bool write = false) {
        std::lock_guard lock(mutex_);
        if (stopping_ || jobs_.size() >= limit_) return false;
        jobs_.push_back({std::move(task), write});
        ready_.notify_one();
        return true;
    }

    void discardReads() {
        std::lock_guard lock(mutex_);
        discardReadsLocked();
    }

    void stop() {
        std::lock_guard lock(mutex_);
        if (stopping_) return;
        stopping_ = true;
        discardReadsLocked();
        ready_.notify_all();
    }

    // Called after the UI has closed. Retrying cancellation also covers a read that had not yet
    // entered its Win32 call when stop() was called.
    void join() {
        for (auto& worker : workers_) {
            if (!worker.thread.joinable()) continue;
            while (WaitForSingleObject(worker.thread.native_handle(), 100) == WAIT_TIMEOUT) {
                std::lock_guard lock(mutex_);
                if (worker.reading) CancelSynchronousIo(worker.thread.native_handle());
            }
            worker.thread.join();
        }
    }

private:
    struct Job {
        std::function<void()> task;
        bool write;
    };
    struct Worker {
        std::thread thread;
        bool reading = false;
    };

    void discardReadsLocked() {
        std::erase_if(jobs_, [](const Job& job) { return !job.write; });
        for (auto& worker : workers_)
            if (worker.reading) CancelSynchronousIo(worker.thread.native_handle());
    }

    void work(Worker& worker) {
        std::unique_lock lock(mutex_);
        for (;;) {
            ready_.wait(lock, [this] { return stopping_ || !jobs_.empty(); });
            if (jobs_.empty()) return;
            Job job = std::move(jobs_.front());
            jobs_.pop_front();
            worker.reading = !job.write;
            lock.unlock();
            job.task();
            lock.lock();
            worker.reading = false;
        }
    }

    std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<Job> jobs_;
    std::vector<Worker> workers_;
    const std::size_t limit_;
    bool stopping_ = false;
};

}  // namespace hse
