// @flow

import EventEmitter from "events";

import * as dom from "./dom";
import HighlightMarkers from "./HighlightMarkers";
import HighlightDecorator from "./HighlightDecorator";
import Highlight from "./Highlight";

export type IterableQueries = string | Array<string>;
export type ScrollToCallback = (HTMLElement) => void;

/**
 * Class responsible for managing the state of the highlight cursor
 *
 * Emits the following events:
 *
 *  - clear: cursor position is cleared
 *  - setiterable: allowable iterable queries set or cleared
 *  - update: cursor position mutated
 */
class Cursor extends EventEmitter {
  markers: HighlightMarkers;
  decorator: HighlightDecorator;
  index: number;
  active: ?Highlight;
  iterableQueries: ?Array<string>;
  total: number;

  /**
   * Class constructor
   *
   * @param {HighlightMarkers} markers - Reference to highlight markers object
   */
  constructor(markers: HighlightMarkers, decorator: HighlightDecorator) {
    super();

    this.markers = markers;
    this.decorator = decorator;
    markers.on("update", () => this.update());

    this.index = -1;
    this.active = null;
    this.iterableQueries = null;
    this.total = 0;
    this.setIterableQueries(null);
  }

  dispose(): void {
    this.removeAllListeners();
    this.iterableQueries = null;
  }

  /**
   * Clear the current cursor state and recalculate number of total iterable highlights */
  clear(): void {
    this.clearActive_();
    this.index = -1;
    this.update(true);
    this.emit("clear");
  }

  /**
   * Set or clear the query sets that the cursor can move through
   *
   * When one or more query sets are specified, cursor movement is restricted to the specified
   * query sets.  When setting the cursor offset, the offset will then apply within the context of
   * the active iterable query sets.
   *
   * The restriction can be lifted at any time by passing `null` to the method.
   *
   * @param {?IterableQueries} queries - An array (or string) containing the query set names
   * or `null` if all query-sets active.
   */
  setIterableQueries(queries: ?IterableQueries): void {
    if (queries == null) {
      this.iterableQueries = null;
    } else if (typeof queries === "string") {
      this.iterableQueries = [queries];
    } else {
      this.iterableQueries = queries.slice();
    }

    this.clear();
    this.emit("setiterable", queries);
  }

  /**
   * Update the total of iterable highlights
   *
   * Causes recomputation of the total available number of active highlights and produces the
   * update event if this number changes.  The event can be forcefully produced it `force` is set
   * to `true`.
   *
   * @param { boolean } force - When `true` causes the "update" event to always be emitted
   */
  update(force: boolean = false): void {
    const total = this.markers.calculateTotalActive(this.iterableQueries);

    if (force || total !== this.total) {
      this.total = total;
      this.emit("update", this.index, this.total);
    }
  }

  /**
   * Set cursor to query referenced by absolute query index
   *
   * @param {number} index - Virtual cursor index
   * @param {boolean} dontRecurse - When `true` instructs the method not to employ recursion
   * @param {ScrollToCallback} scrollTo - Optional custom function to invoke if highlight being
   * moved to is not active on the page
   *
   * @returns {boolean} `true` if move occurred
   */
  set(index: number, dontRecurse: boolean, scrollTo?: ScrollToCallback): boolean {
    if (index < 0) {
      throw new Error("Invalid cursor index specified: " + index);
    }

    const marker = this.markers.find(index, this.iterableQueries);
    // If index overflown, set to first highlight
    if (marker == null) {
      if (!dontRecurse) {
        return this.set(0, true);
      }
      return false;
    }

    // Clear currently active highlight, if any, and set requested highlight active
    this.clearActive_();
    const coll = marker.highlight.elements;
    // Scroll viewport if element not visible
    if (coll.length > 0) {
      this.active = marker.highlight;
      this.decorator.setActive(this.active);

      const first = coll[0];
      if (typeof scrollTo === "function") {
        try {
          scrollTo(first);
        } catch (x) {
          console.error("failed to scroll to highlight:", x);
        }
      } else if (!dom.isInView(first)) {
        first.scrollIntoView();
      }
    }

    if (this.index === index) {
      return false;
    }

    this.index = index;
    this.emit("update", index, this.total);
    return true;
  }

  /**
   * Move cursor position to the previous query in the active query set
   *
   * If the cursor moves past the first query in the active query set, the active query set moves
   * to the previous available one and the cursor position to its last query.  If the current query
   * set is the first in the collection and thus it is not possible to move to the previous query
   * set, the last query set is made active instead, thus ensuring that the cursor always rolls
   * over.
   */
  prev(): void {
    if (this.total > 0) {
      this.set((this.index < 1 ? this.total : this.index) - 1, false);
    }
  }

  /**
   * Move cursor position to the next query in the active query set
   *
   * If the cursor moves past the last query in the active query set, the active query set moves to
   * the next available one and the cursor position to its first query.  If the current query set
   * is the last in the collection and thus it is not possible to move to the next query set, the
   * first query set is made active instead, thus ensuring that the cursor always rolls over.
   */
  next(): void {
    this.set(this.index + 1, false);
  }

  //  Private interface
  // ----------------------------------------
  /**
   * Clear the currently active cursor highlight
   *
   * The active cursor highlight is the element or elements at the current cursor position.
   * @access private
   */
  clearActive_(): void {
    if (this.active != null) {
      this.decorator.setInactive(this.active);
      this.active = null;
    }
  }
}

export default Cursor;
