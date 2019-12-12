// @flow

import * as dom from './dom';
import TextContent from './TextContent';
import TextRange from './TextRange';
import type { RangeDescriptor } from './TextRange';
import TextNodeVisitor from './TextNodeVisitor';
import HighlightDecorator from './HighlightDecorator';
import Highlight from './Highlight';

/**
 * Return boolean value indicative of whether a given node is a highlight container
 * @access private
 *
 * @param {Node} node - DOM element to check
 * @returns {boolean} `true` if it is a highlight container
 */
export function isHighlight(node: Node): boolean {
  // This is potentially problematic if the document uses a data attribute of the same name.  We
  // should introduce some sort of signature that is randomly generated by the parent DOM
  // Highlighter instance and which all highlight elements are expected to carry.
  return node.nodeType === 1 && (node: any).dataset.dhHighlight === 'true';
}

export default class HighlightRenderer {
  content: TextContent;
  decorator: HighlightDecorator;

  constructor(content: TextContent, decorator: HighlightDecorator) {
    this.content = content;
    this.decorator = decorator;
  }

  /**
   * Highlight a range
   *
   * Highlights a given range by wrapping one or more text nodes with a `span` tag and applying a
   * particular CSS class.
   *
   * @param {string} className - The CSS class name to apply
   */
  surround(highlight: Highlight): Array<HTMLElement> {
    const { start: rangeStart, end: rangeEnd } = highlight.range;
    // Optimised case: highlighting does not span multiple nodes
    if (rangeStart.marker.node === rangeEnd.marker.node) {
      const elements = [this._surround(rangeStart, rangeStart.offset, rangeEnd.offset)];
      highlight.range.clearStartOffset();
      this.decorator.decorate(elements, highlight);
      return elements;
    }

    // Highlighting spans 2 or more nodes, which means we need to build a representation of all the
    // text nodes contained in the start to end range, but excluding the start and end nodes
    const visitor = new TextNodeVisitor(rangeStart.marker.node, this.content.root);
    const end = rangeEnd.marker.node;
    const coll = [];
    const elements = [];

    // TODO: we assume `visitor.next()' will never return null because `end´ is within bounds
    while (visitor.next() !== end) {
      coll.push((visitor.current: any));
    }

    // Apply highlighting to start and end nodes, and to any nodes in between, if applicable.
    // Highlighting for the start and end nodes may require text node truncation but not for the
    // nodes in between.
    elements.push(this._surround(rangeStart, rangeStart.offset, null));
    coll.forEach(n => {
      elements.push(this._surroundWhole(n));
    });
    elements.push(this._surround(rangeEnd, 0, rangeEnd.offset));
    highlight.range.clearStartOffset();
    this.decorator.decorate(elements, highlight);
    return elements;
  }

  decorate(highlight: Highlight): void {
    this.decorator.decorate(highlight.elements, highlight);
  }

  // Private interface
  // -----------------
  /**
   * Truncate text node and apply highlighting
   *
   * Truncates text node into 2 or 3 text nodes and apply highlighting to relevant node, which is
   * always the node referenced by `descr.marker.node`.
   *
   * @param {Object} descr - Start or end `Range` descriptor
   * @param {number} start - Start offset
   * @param {number | null} end - End offset
   * @param {string} className - CSS class name to apply
   */
  _surround(descr: RangeDescriptor, start: number, end: number | null): HTMLElement {
    this.content.truncate(
      descr.marker,
      start,
      end == null ? descr.marker.node.nodeValue.length - 1 : end
    );

    return this._createHighlightElement(descr.marker.node);
  }

  /**
   * Apply highlighting fully to a text node
   *
   * No text node truncation occurs.
   *
   * @param {Node} node - Text node to apply highlighting to
   * @param {string} className - CSS class name to apply
   * */
  _surroundWhole(node: Node): HTMLElement {
    return this._createHighlightElement(node);
  }

  _createHighlightElement(node: Node): HTMLElement {
    const span = document.createElement('span');
    // Stamp the highlight element with a data attribute that is expected to be unique to
    // highlights produced by DOM Highlighter instances and which enables `TextNodeXPath` instances
    // to identify highlight elements when computing the _true_ XPath representation of an
    // arbitrary selection.  This is because it is not desirable at all for the computed XPath
    // representation to include highlight elements created by DOM Highlighter.
    //
    // This is potentially problematic if the document uses a data attribute of the same name.  We
    // should introduce some sort of signature that is randomly generated by the parent DOM
    // Highlighter instance and which all highlight elements are expected to carry.
    span.dataset.dhHighlight = 'true';
    (node.parentNode: any).insertBefore(span, node);
    span.appendChild(node);
    return span;
  }
}
