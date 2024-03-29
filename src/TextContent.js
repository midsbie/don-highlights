// @flow

import * as dom from "./dom";

export type Marker = {| node: Node, offset: number |};
export type MarkerArray = Array<Marker>;

const IGNORE_TAGNAMES = new Set([
  "HTML",
  "HEAD",
  "META",
  "SCRIPT",
  "STYLE",
  "CANVAS",
  "IFRAME",
  "SVG",
  "AUDIO",
  "VIDEO",
]);

/**
 * Class responsible for building and keeping a convenient representation
 * of the text present in an HTML DOM sub-tree.
 */
export default class TextContent {
  root: HTMLElement;
  text: string;
  // FIXME: add type
  markers: MarkerArray;

  /**
   * Class constructor
   * @param {Node|jQuery} root - Reference to a DOM element
   */
  constructor(root: HTMLElement) {
    this.root = root;
    this.text = "";
    this.markers = [];
  }

  dispose(): void {
    this.text = "";
    this.markers = [];
  }

  setRoot(root: HTMLElement): void {
    this.root = root;
    this.parse();
  }

  /**
   * Parse DOM tree and produce internal representation of the text
   *
   * The internal representation of the text present in the DOM sub-tree of the `root` consists of
   * an array of global offsets for every text node in the document, and a reference to the
   * corresponding text node, stored in marker descriptors. In addition, a regular string (`text`)
   * holds the text contents of the document to enable text-based searches.
   *
   * A marker descriptor is of the form:
   * ```
   * {
   *   node:   Node      // reference to text node
   *   offset: integer   // global offset
   * }
   * ```
   *
   * Should only be invoked when the HTML structure mutates, e.g. a new document is loaded.
   * */
  parse(): void {
    this.text = "";
    let markers = (this.markers = []);
    const offset = this._visit(this.root, 0);

    // Sanity check
    if (process.env.NODE_ENV === "development") {
      if (this.markers.length !== 0) {
        const marker = markers[markers.length - 1];
        if (offset - marker.node.nodeValue.length !== marker.offset) {
          throw new Error("Invalid state detected: offset mismatch");
        }
      }
    }
  }

  /**
   * Truncate text node
   *
   * Truncates a text node given by `marker` by turning it into 2 or 3 text nodes, with one of them
   * used for highlighting purposes.
   *
   * If `start == 0` and `end == text.length - 1`, no truncation takes place **but** the old text
   * node is replaced by a new one.  This method therefore assumes that the caller has checked to
   * ensure text truncation is required.
   *
   * Truncation takes place in the following manner:
   *
   *  - if `start > 0`: truncate `[ 0 .. start - 1 ]
   *  - create new text node at `[ start .. end ]`
   *  - if `end != text.length - 1`: truncate `[ end .. text.length - 1 ]`
   *
   * @param {Marker} marker - Reference to descriptor of text node to truncate
   * @param {number} start - Offset where to start truncation
   * @param {number} end - Offset where truncation ends
   *
   * @returns {number} Index of marker descriptor
   */
  truncate(marker: Marker, start: number, end: number): number {
    const old = marker.node; // The old text node
    const text = old.nodeValue;
    let index = this.indexOf(marker.offset);

    // Sanity checks
    if (start < 0 || end < 0 || start > end) {
      throw new Error("Invalid truncation parameters");
    } else if (end >= text.length) {
      throw new Error("End offset overflow");
    }

    // Chars 0..start - 1
    if (start > 0) {
      const node = document.createTextNode(text.substr(0, start));
      // Since we're creating a new text node out of the old text node, we need to add a new entry
      // to the markers array
      this.markers.splice(index, 0, {
        offset: marker.offset,
        node: dom.insertBefore(node, old),
      });

      ++index;
    }

    // Chars start..end
    // ----------------
    // We don't need to add a new entry to the markers array since we're not technically creating a
    // new text node, just replacing it with one with the required [start..end] substring.  We do
    // need to update the node's offset though.
    marker.offset += start;
    marker.node = dom.insertBefore(
      document.createTextNode(text.substr(start, end - start + 1)),
      marker.node
    );

    // Chars end + 1..length
    if (end !== text.length - 1) {
      if (index >= this.markers.length) {
        throw new Error("Detected invalid index");
      }

      // We're again creating a new text node out of the old text node and thus need to add a new
      // entry to the markers array.
      this.markers.splice(index + 1, 0, {
        offset: marker.offset + end - start + 1,
        node: dom.insertAfter(document.createTextNode(text.substr(end + 1)), marker.node),
      });
    }

    if (process.env.NODE_ENV === "development") {
      this.assert();
    }

    // Remove old node.
    (old.parentNode: any).removeChild(old);
    return index;
  }

  /**
   * Return the index of the marker descriptor of a given text offset.
   *
   * Throws an exception if the offset is invalid.
   *
   * Note: employs the binary search algorithm.
   *
   * @param {number} offset - The offset to look up
   * @returns {number} The marker index that contains `offset`
   */
  indexOf(offset: number): number {
    const markers = this.markers;
    let min = 0;
    let max = markers.length - 1;

    while (min < max) {
      const mid = Math.floor((min + max) / 2);

      if (markers[mid].offset < offset) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }

    if (markers[min].offset <= offset) {
      return min;
    } else if (min === 0) {
      throw new Error("Invalid offset of text content state");
    }

    return min - 1;
  }

  /**
   * Find the index of the marker descriptor of a given text node element
   *
   * @param {Node} element - Reference to the text node to look up
   * @param {number} [start=0] - Start marker index if known for a fact that the text node is to be
   * found **after** a certain offset
   *
   * @returns {number} The marker index of `element` or `-1` if not found.
   */
  find(element: Node, start: ?number = 0): number {
    if (element.nodeType !== 3) {
      return -1;
    }

    for (let i = start == null ? 0 : start, l = this.markers.length; i < l; ++i) {
      if (this.markers[i].node === element) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Return the offset marker descriptor at a given index
   *
   * Throws an exception if the given `index` is out of bounds.
   *
   * @param {number} index - Marker index
   * @returns {Marker} The offset marker descriptor
   */
  at(index: number): Marker {
    if (index < 0 || index >= this.markers.length) {
      throw new Error("Invalid marker index");
    }

    return this.markers[index];
  }

  /**
   * Extract string starting at given offset
   *
   * @param {number} offset - Offset to start string extraction
   * @param {number} len - Length of string to extract
   *
   * @returns {string} Extracted string
   */
  substr(offset: number, len: number): string {
    if (offset < 0 || offset >= this.text.length) {
      throw new Error("Invalid start offset");
    } else if (len < 0) {
      throw new Error("Invalid length");
    }

    return this.text.substr(offset, len);
  }

  /**
   * Assert textual representation is valid
   *
   * Debug method for asserting that the current textual representation is valid, in particular
   * that the offset markers are all contiguous.
   */
  assert(): void {
    let offset = 0;

    // Ensure offsets are contiguous
    for (let i = 0, l = this.markers.length; i < l; ++i) {
      const marker = this.markers[i];

      if (marker.offset !== offset) {
        console.error("invalid offset: %d@ %d:%d ->", i, marker.offset, offset, marker);
        throw new Error("Halting due to invalid offset");
      }

      offset += marker.node.nodeValue.length;
    }
  }

  //  Private interface
  // ----------------------------------------
  _visit(node: Node, offset: number): number {
    // Only interested in text nodes
    if (node.nodeType === 3) {
      const content = node.nodeValue;
      const length = content.length;

      // Do NOT record this node if it is empty.  Not doing so leads to one or more duplicate
      // markers in the registry pointing to the same offset, which then may cause problems
      // when highlighting.
      //
      // Motivated by ticket: https://gitlab.softgeist.com/com/sceptiq/-/issues/755
      if (length < 1) return offset;

      // Save reference to text node and store global offset in the markers array
      this.markers.push({ node: node, offset: offset });

      // Do not contain a literal representation of the text content of elements whose text is
      // never rendered by the browser.  Instead, contain spaces such that we are able to carry out
      // searches on the text using carefully crafted regular expressions that skip over text
      // content which would otherwise cause some regexp searches to fail.  For an understanding of
      // what is meant, consider the following subtree:
      //
      // <P>Positive
      //   <SCRIPT>document.write('something');</SCRIPT>
      // match</P>
      //
      // If the literal value ot the SCRIPT element above is included, we would end up with an
      // internal text representation of the page as given:
      //
      // Positive
      //   document.write('something');
      // match
      //
      // This means that any attempt to perform a text search for `/positive\s+match/i`, would
      // fail.  The solution, then, is to replace the content of nodes known never to render the
      // literal representation of the text they contain by an _equal amount of spaces_.  The
      // above becomes:
      //
      // Positive
      //   ____________________________
      // match
      //
      // /positive\s+match/i.test(this.text) => true
      // Note: underscore character above illustrates original content replaced by spaces.
      // --
      // $FlowFixMe: parent node of a text node is guaranteed to exist and to be of element type.
      if (IGNORE_TAGNAMES.has(node.parentElement.tagName)) {
        this.text += " ".repeat(length);
      } else {
        this.text += content;
      }
      return offset + length;
    }

    // If current node is not of type text, process its children nodes, if any.
    const ch = node.childNodes;
    if (ch.length > 0) {
      for (let i = 0, l = ch.length; i < l; ++i) {
        offset = this._visit(ch[i], offset);
      }
    }

    return offset;
  }
}
