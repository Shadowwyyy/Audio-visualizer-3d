/**
 * Beat Scheduler - triggers visual events based on Spotify audio analysis.
 * Works with PlaybackSync to fire callbacks at the right moments.
 */

class BeatScheduler {
    constructor() {
        this.analysis = null;
        this.beats = [];
        this.segments = [];
        this.sections = [];
        
        // Track which events we've already fired
        this.lastBeatIndex = -1;
        this.lastSegmentIndex = -1;
        this.lastSectionIndex = -1;
        
        // Callbacks
        this.onBeat = null;
        this.onSegment = null;
        this.onSection = null;
        
        // Lookahead for scheduling (ms)
        this.lookahead = 50;
    }

    /**
     * Load analysis data for a track.
     */
    loadAnalysis(analysis) {
        if (!analysis) {
            this.clear();
            return;
        }
        
        this.analysis = analysis;
        this.beats = analysis.beats || [];
        this.segments = analysis.segments || [];
        this.sections = analysis.sections || [];
        
        // Reset indices
        this.lastBeatIndex = -1;
        this.lastSegmentIndex = -1;
        this.lastSectionIndex = -1;
        
        console.log(`Loaded analysis: ${this.beats.length} beats, ${this.segments.length} segments, ${this.sections.length} sections`);
    }

    /**
     * Clear all analysis data.
     */
    clear() {
        this.analysis = null;
        this.beats = [];
        this.segments = [];
        this.sections = [];
        this.lastBeatIndex = -1;
        this.lastSegmentIndex = -1;
        this.lastSectionIndex = -1;
    }

    /**
     * Call this every frame with current playback position.
     * Fires callbacks for any events that should trigger.
     * 
     * @param {number} positionMs - Current playback position in milliseconds
     */
    update(positionMs) {
        if (!this.analysis) return;
        
        const positionSec = positionMs / 1000;
        const lookaheadSec = this.lookahead / 1000;
        
        // Check beats
        this._checkEvents(
            this.beats,
            positionSec,
            lookaheadSec,
            'lastBeatIndex',
            this.onBeat
        );
        
        // Check segments
        this._checkEvents(
            this.segments,
            positionSec,
            lookaheadSec,
            'lastSegmentIndex',
            this.onSegment
        );
        
        // Check sections
        this._checkEvents(
            this.sections,
            positionSec,
            lookaheadSec,
            'lastSectionIndex',
            this.onSection
        );
    }

    /**
     * Internal: check an event array and fire callbacks.
     */
    _checkEvents(events, positionSec, lookaheadSec, indexKey, callback) {
        if (!events.length || typeof callback !== 'function') return;
        
        const currentIndex = this[indexKey];
        
        // Find events in our window
        for (let i = currentIndex + 1; i < events.length; i++) {
            const event = events[i];
            const eventStart = event.start;
            
            // Event is in the past or within lookahead window
            if (eventStart <= positionSec + lookaheadSec) {
                // Only fire if we haven't passed it completely
                if (eventStart + (event.duration || 0) >= positionSec - 0.1) {
                    this[indexKey] = i;
                    callback(event, i);
                }
            } else {
                // Events are sorted, no need to check further
                break;
            }
        }
    }

    /**
     * Seek to a position - reset indices appropriately.
     */
    seek(positionMs) {
        const positionSec = positionMs / 1000;
        
        // Find the last event before this position for each type
        this.lastBeatIndex = this._findLastEventBefore(this.beats, positionSec);
        this.lastSegmentIndex = this._findLastEventBefore(this.segments, positionSec);
        this.lastSectionIndex = this._findLastEventBefore(this.sections, positionSec);
    }

    /**
     * Binary search to find last event before a position.
     */
    _findLastEventBefore(events, positionSec) {
        if (!events.length) return -1;
        
        let low = 0;
        let high = events.length - 1;
        let result = -1;
        
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (events[mid].start < positionSec) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        
        return result;
    }

    /**
     * Get current segment at a position (useful for interpolation).
     */
    getCurrentSegment(positionMs) {
        const positionSec = positionMs / 1000;
        const index = this._findLastEventBefore(this.segments, positionSec + 0.1);
        
        if (index >= 0 && index < this.segments.length) {
            return this.segments[index];
        }
        return null;
    }

    /**
     * Get current section at a position.
     */
    getCurrentSection(positionMs) {
        const positionSec = positionMs / 1000;
        const index = this._findLastEventBefore(this.sections, positionSec + 0.1);
        
        if (index >= 0 && index < this.sections.length) {
            return this.sections[index];
        }
        return null;
    }
}


// Export
window.BeatScheduler = BeatScheduler;