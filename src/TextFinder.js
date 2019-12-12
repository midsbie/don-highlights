// @flow

import merge from 'merge';

import type { HighlightTextQuery } from './typedefs';
import TextContent from './TextContent';
import Finder from './Finder';
import TextRange from './TextRange';

/* FIXME: create a class for matching of regular expression subjects. */
/**
 * Class responsible for finding text in a `TextContent` instance
 */
export default class TextFinder extends Finder {
  /**
   * Determine if given subject is of type accepted by the `TextFinder` class
   *
   * This method determines if a given subject can be used to instantiate a `TextFinder` class.
   *
   * @param {any} subject - Subject to determine
   * @returns {boolean} `true` if subject can be used to instantiate a `TextFinder` class
   */
  static isSubject(subject: any): boolean {
    return typeof subject === 'string' || subject instanceof RegExp;
  }

  /**
   * Class constructor
   *
   * @param {TextContent} content - Reference to `TextContent` instance
   * @param {HighlightTextQuery} query - Query string to match
   */
  constructor(content: TextContent, query: HighlightTextQuery) {
    // Construct base class
    super(content);

    // Build an array containing all hits of `subject´
    let match;
    const re =
      query instanceof RegExp
        ? query
        : new RegExp(query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi');

    while ((match = re.exec(this.content.text)) !== null) {
      // $FlowFixMe: erroring out on match below for some strange reason
      this.results.push({ length: match[0].length, index: match.index });
    }
  }

  /**
   * Return next available match
   *
   * @returns {TextRange | null} Returns a `TextRange` if a match is available, or `null` if no
   * more matches are available.
   */
  next(): TextRange | null {
    if (this.current >= this.results.length) {
      return null;
    }

    const match = this.results[this.current];
    const length = match.length;
    const start = this.getAt_(match.index);
    let end;
    // Re-use start marker descriptor if end offset within bounds of start text node
    if (start.offset + length <= start.marker.node.nodeValue.length) {
      end = merge({}, start);
      end.offset = start.offset + length - 1;
    } else {
      end = this.getAt_(match.index + length - 1);
    }

    const range = new TextRange(this.content, start, end);
    ++this.current;

    return range;
  }
}
