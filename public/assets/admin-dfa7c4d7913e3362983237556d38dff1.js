// Last commit: 1f0c355 (2013-09-18 11:01:11 -0400)


(function() {
var get = Ember.get, set = Ember.set;

function samePosition(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

function positionElement() {
  var element, position, _position;

  Ember.instrument('view.updateContext.positionElement', this, function() {
    element = get(this, 'element');
    position = get(this, 'position');
    _position = this._position;

    if (!position || !element) { return; }

    // TODO: avoid needing this by avoiding unnecessary
    // calls to this method in the first place
    if (samePosition(position, _position)) { return; }
    this._parentView.applyTransform(element, position.x, position.y);

    this._position = position;
  }, this);
}

Ember.ListItemViewMixin = Ember.Mixin.create({
  init: function(){
    this._super();
    this.one('didInsertElement', positionElement);
  },
  classNames: ['ember-list-item-view'],
  _position: null,
  _positionDidChange: Ember.observer(positionElement, 'position'),
  _positionElement: positionElement
});

})();



(function() {
var get = Ember.get, set = Ember.set;

var backportedInnerString = function(buffer) {
  var content = [], childBuffers = buffer.childBuffers;

  Ember.ArrayPolyfills.forEach.call(childBuffers, function(buffer) {
    var stringy = typeof buffer === 'string';
    if (stringy) {
      content.push(buffer);
    } else {
      buffer.array(content);
    }
  });

  return content.join('');
};

function willInsertElementIfNeeded(view) {
  if (view.willInsertElement) {
    view.willInsertElement();
  }
}

function didInsertElementIfNeeded(view) {
  if (view.didInsertElement) {
    view.didInsertElement();
  }
}

function rerender() {
  var element, buffer, context, hasChildViews;
  element = get(this, 'element');

  if (!element) { return; }

  context = get(this, 'context');

  // releases action helpers in contents
  // this means though that the ListViewItem itself can't use classBindings or attributeBindings
  // need support for rerender contents in ember
  this.triggerRecursively('willClearRender');

  if (this.lengthAfterRender > this.lengthBeforeRender) {
    this.clearRenderedChildren();
    this._childViews.length = this.lengthBeforeRender; // triage bug in ember
  }

  if (context) {
    buffer = Ember.RenderBuffer();
    buffer = this.renderToBuffer(buffer);

    // check again for childViews, since rendering may have added some
    hasChildViews = this._childViews.length > 0;

    if (hasChildViews) {
      this.invokeRecursively(willInsertElementIfNeeded, false);
    }

    element.innerHTML = buffer.innerString ? buffer.innerString() : backportedInnerString(buffer);

    set(this, 'element', element);

    this.transitionTo('inDOM');

    if (hasChildViews) {
      this.invokeRecursively(didInsertElementIfNeeded, false);
    }
  } else {
    element.innerHTML = ''; // when there is no context, this view should be completely empty
  }
}

/**
  The `Ember.ListViewItem` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element
  with `ember-list-item-view` class. It allows you to specify a custom item
  handlebars template for `Ember.ListView`.

  Example:

  ```handlebars
  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.View
  @class ListItemView
  @namespace Ember
*/
Ember.ListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  updateContext: function(newContext){
    var context = get(this, 'context');
    Ember.instrument('view.updateContext.render', this, function() {
      if (context !== newContext) {
        this.set('context', newContext);
        if (newContext instanceof Ember.ObjectController) {
          this.set('controller', newContext);
        }
      }
    }, this);
  },
  rerender: function () { Ember.run.scheduleOnce('render', this, rerender); },
  _contextDidChange: Ember.observer(rerender, 'context', 'controller')
});

})();



(function() {
var get = Ember.get, set = Ember.set;

Ember.ReusableListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  init: function(){
    this._super();
    this.set('context', Ember.ObjectProxy.create());
  },
  isVisible: Ember.computed('context.content', function(){
    return !!this.get('context.content');
  }),
  updateContext: function(newContext){
    var context = get(this, 'context.content');
    if (context !== newContext) {
      if (this.state === 'inDOM') {
        this.prepareForReuse(newContext);
      }
      set(this, 'context.content', newContext);
    }
  },
  prepareForReuse: Ember.K
});

})();



(function() {
var el = document.createElement('div'), style = el.style;

var propPrefixes = ['Webkit', 'Moz', 'O', 'ms'];

function testProp(prop) {
  if (prop in style) return prop;
  var uppercaseProp = prop.charAt(0).toUpperCase() + prop.slice(1);
  for (var i=0; i<propPrefixes.length; i++) {
    var prefixedProp = propPrefixes[i] + uppercaseProp;
    if (prefixedProp in style) {
      return prefixedProp;
    }
  }
  return null;
}

var transformProp = testProp('transform');
var perspectiveProp = testProp('perspective');

var supports2D = transformProp !== null;
var supports3D = perspectiveProp !== null;

Ember.ListViewHelper = {
  transformProp: transformProp,
  applyTransform: (function(){
    if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })(),
  apply3DTransform: (function(){
    if (supports3D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      };
    } else if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })()
};

})();



(function() {
var get = Ember.get, set = Ember.set,
min = Math.min, max = Math.max, floor = Math.floor,
ceil = Math.ceil,
forEach = Ember.ArrayPolyfills.forEach;

function addContentArrayObserver() {
  var content = get(this, 'content');
  if (content) {
    content.addArrayObserver(this);
  }
}

function removeAndDestroy(object){
  this.removeObject(object);
  object.destroy();
}

function syncChildViews(){
  Ember.run.once(this, '_syncChildViews');
}

function sortByContentIndex (viewOne, viewTwo){
  return get(viewOne, 'contentIndex') - get(viewTwo, 'contentIndex');
}

function notifyMutationListeners() {
  if (Ember.View.notifyMutationListeners) {
    Ember.run.once(Ember.View, 'notifyMutationListeners');
  }
}

var domManager = Ember.create(Ember.ContainerView.proto().domManager);

domManager.prepend = function(view, html) {
  view.$('.ember-list-container').prepend(html);
  notifyMutationListeners();
};

function syncListContainerWidth(){
  var elementWidth, columnCount, containerWidth, element;

  elementWidth = get(this, 'elementWidth');
  columnCount = get(this, 'columnCount');
  containerWidth = elementWidth * columnCount;
  element = this.$('.ember-list-container');

  if (containerWidth && element) {
    element.css('width', containerWidth);
  }
}

function enableProfilingOutput() {
  function before(name, time, payload) {
    console.time(name);
  }

  function after (name, time, payload) {
    console.timeEnd(name);
  }

  if (Ember.ENABLE_PROFILING) {
    Ember.subscribe('view._scrollContentTo', {
      before: before,
      after: after
    });
    Ember.subscribe('view.updateContext', {
      before: before,
      after: after
    });
  }
}

/**
  @class Ember.ListViewMixin
  @namespace Ember
*/
Ember.ListViewMixin = Ember.Mixin.create({
  itemViewClass: Ember.ListItemView,
  emptyViewClass: Ember.View,
  classNames: ['ember-list-view'],
  attributeBindings: ['style'],
  domManager: domManager,
  scrollTop: 0,
  bottomPadding: 0,
  _lastEndingIndex: 0,
  paddingCount: 1,

  /**
    @private

    Setup a mixin.
    - adding observer to content array
    - creating child views based on height and length of the content array

    @method init
  */
  init: function() {
    this._super();
    this.on('didInsertElement', syncListContainerWidth);
    this.columnCountDidChange();
    this._syncChildViews();
    this._addContentArrayObserver();
  },

  _addContentArrayObserver: Ember.beforeObserver(function() {
    addContentArrayObserver.call(this);
  }, 'content'),

  /**
    Called on your view when it should push strings of HTML into a
    `Ember.RenderBuffer`.

    Adds a [div](https://developer.mozilla.org/en-US/docs/HTML/Element/div)
    with a required `ember-list-container` class.

    @method render
    @param {Ember.RenderBuffer} buffer The render buffer
  */
  render: function(buffer) {
    buffer.push('<div class="ember-list-container">');
    this._super(buffer);
    buffer.push('</div>');
  },

  willInsertElement: function() {
    if (!this.get("height") || !this.get("rowHeight")) {
      throw "A ListView must be created with a height and a rowHeight.";
    }
    this._super();
  },

  /**
    @private

    Sets inline styles of the view:
    - height
    - width
    - position
    - overflow
    - -webkit-overflow
    - overflow-scrolling

    Called while attributes binding.

    @property {Ember.ComputedProperty} style
  */
  style: Ember.computed('height', 'width', function() {
    var height, width, style, css;

    height = get(this, 'height');
    width = get(this, 'width');
    css = get(this, 'css');

    style = '';

    if (height) { style += 'height:' + height + 'px;'; }
    if (width)  { style += 'width:'  + width  + 'px;'; }

    for ( var rule in css ){
      if (css.hasOwnProperty(rule)) {
        style += rule + ':' + css[rule] + ';';
      }
    }

    return style;
  }),

  /**
    @private

    Performs visual scrolling. Is overridden in Ember.ListView.

    @method scrollTo
  */
  scrollTo: function(y) {
    throw 'must override to perform the visual scroll and effectively delegate to _scrollContentTo';
  },

  /**
    @private

    Internal method used to force scroll position

    @method scrollTo
  */
  _scrollTo: Ember.K,

  /**
    @private
    @method _scrollContentTo
  */
  _scrollContentTo: function(y) {
    var startingIndex, endingIndex,
        contentIndex, visibleEndingIndex, maxContentIndex,
        contentIndexEnd, contentLength, scrollTop;

    scrollTop = max(0, y);

    Ember.instrument('view._scrollContentTo', {
      scrollTop: scrollTop,
      content: get(this, 'content'),
      startingIndex: this._startingIndex(),
      endingIndex: min(max(get(this, 'content.length') - 1, 0), this._startingIndex() + this._numChildViewsForViewport())
    }, function () {
      contentLength = get(this, 'content.length');
      set(this, 'scrollTop', scrollTop);

      maxContentIndex = max(contentLength - 1, 0);

      startingIndex = this._startingIndex();
      visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

      endingIndex = min(maxContentIndex, visibleEndingIndex);

      this.trigger('scrollYChanged', y);

      if (startingIndex === this._lastStartingIndex &&
          endingIndex === this._lastEndingIndex) {
        return;
      }

      this._reuseChildren();

      this._lastStartingIndex = startingIndex;
      this._lastEndingIndex = endingIndex;
    }, this);
  },

  /**
    @private

    Computes the height for a `Ember.ListView` scrollable container div.
    You must specify `rowHeight` parameter for the height to be computed properly.

    @property {Ember.ComputedProperty} totalHeight
  */
  totalHeight: Ember.computed('content.length', 'rowHeight', 'columnCount', 'bottomPadding', function() {
    var contentLength, rowHeight, columnCount, bottomPadding;

    contentLength = get(this, 'content.length');
    rowHeight = get(this, 'rowHeight');
    columnCount = get(this, 'columnCount');
    bottomPadding = get(this, 'bottomPadding');

    return ((ceil(contentLength / columnCount)) * rowHeight) + bottomPadding;
  }),

  /**
    @private
    @method _prepareChildForReuse
  */
  _prepareChildForReuse: function(childView) {
    childView.prepareForReuse();
  },

  /**
    @private
    @method _reuseChildForContentIndex
  */
  _reuseChildForContentIndex: function(childView, contentIndex) {
    var content, context, newContext, childsCurrentContentIndex, position, enableProfiling;

    content = get(this, 'content');
    enableProfiling = get(this, 'enableProfiling');
    position = this.positionForIndex(contentIndex);
    set(childView, 'position', position);

    set(childView, 'contentIndex', contentIndex);

    if (enableProfiling) {
      Ember.instrument('view._reuseChildForContentIndex', position, function(){}, this);
    }

    newContext = content.objectAt(contentIndex);
    childView.updateContext(newContext);
  },

  /**
    @private
    @method positionForIndex
  */
  positionForIndex: function(index){
    var elementWidth, width, columnCount, rowHeight, y, x;

    elementWidth = get(this, 'elementWidth') || 1;
    width = get(this, 'width') || 1;
    columnCount = get(this, 'columnCount');
    rowHeight = get(this, 'rowHeight');

    y = (rowHeight * floor(index/columnCount));
    x = (index % columnCount) * elementWidth;

    return {
      y: y,
      x: x
    };
  },

  /**
    @private
    @method _childViewCount
  */
  _childViewCount: function() {
    var contentLength, childViewCountForHeight;

    contentLength = get(this, 'content.length');
    childViewCountForHeight = this._numChildViewsForViewport();

    return min(contentLength, childViewCountForHeight);
  },

  /**
    @private

    Returns a number of columns in the Ember.ListView (for grid layout).

    If you want to have a multi column layout, you need to specify both
    `width` and `elementWidth`.

    If no `elementWidth` is specified, it returns `1`. Otherwise, it will
    try to fit as many columns as possible for a given `width`.

    @property {Ember.ComputedProperty} columnCount
  */
  columnCount: Ember.computed('width', 'elementWidth', function() {
    var elementWidth, width, count;

    elementWidth = get(this, 'elementWidth');
    width = get(this, 'width');

    if (elementWidth) {
      count = floor(width / elementWidth);
    } else {
      count = 1;
    }

    return count;
  }),

  /**
    @private

    Fires every time column count is changed.

    @event columnCountDidChange
  */
  columnCountDidChange: Ember.observer(function(){
    var ratio, currentScrollTop, proposedScrollTop, maxScrollTop,
        scrollTop, lastColumnCount, newColumnCount, element;

    lastColumnCount = this._lastColumnCount;

    currentScrollTop = get(this, 'scrollTop');
    newColumnCount = get(this, 'columnCount');
    maxScrollTop = get(this, 'maxScrollTop');
    element = get(this, 'element');

    this._lastColumnCount = newColumnCount;

    if (lastColumnCount) {
      ratio = (lastColumnCount / newColumnCount);
      proposedScrollTop = currentScrollTop * ratio;
      scrollTop = min(maxScrollTop, proposedScrollTop);

      this._scrollTo(scrollTop);
      set(this, 'scrollTop', scrollTop);
    }

    if (arguments.length > 0) {
      // invoked by observer
      Ember.run.schedule('afterRender', this, syncListContainerWidth);
    }
  }, 'columnCount'),

  /**
    @private

    Computes max possible scrollTop value given the visible viewport
    and scrollable container div height.

    @property {Ember.ComputedProperty} maxScrollTop
  */
  maxScrollTop: Ember.computed('height', 'totalHeight', function(){
    var totalHeight, viewportHeight;

    totalHeight = get(this, 'totalHeight');
    viewportHeight = get(this, 'height');

    return max(0, totalHeight - viewportHeight);
  }),

  /**
    @private

    Computes the number of views that would fit in the viewport area.
    You must specify `height` and `rowHeight` parameters for the number of
    views to be computed properly.

    @method _numChildViewsForViewport
  */
  _numChildViewsForViewport: function() {
    var height, rowHeight, paddingCount, columnCount;

    height = get(this, 'height');
    rowHeight = get(this, 'rowHeight');
    paddingCount = get(this, 'paddingCount');
    columnCount = get(this, 'columnCount');

    return (ceil(height / rowHeight) * columnCount) + (paddingCount * columnCount);
  },

  /**
    @private

    Computes the starting index of the item views array.
    Takes `scrollTop` property of the element into account.

    Is used in `_syncChildViews`.

    @method _startingIndex
  */
  _startingIndex: function() {
    var scrollTop, rowHeight, columnCount, calculatedStartingIndex,
        contentLength, largestStartingIndex;

    contentLength = get(this, 'content.length');
    scrollTop = get(this, 'scrollTop');
    rowHeight = get(this, 'rowHeight');
    columnCount = get(this, 'columnCount');

    calculatedStartingIndex = floor(scrollTop / rowHeight) * columnCount;

    largestStartingIndex = max(contentLength - 1, 0);

    return min(calculatedStartingIndex, largestStartingIndex);
  },

  /**
    @private
    @event contentWillChange
  */
  contentWillChange: Ember.beforeObserver(function() {
    var content;

    content = get(this, 'content');

    if (content) {
      content.removeArrayObserver(this);
    }
  }, 'content'),

  /**),
    @private
    @event contentDidChange
  */
  contentDidChange: Ember.observer(function() {
    addContentArrayObserver.call(this);
    syncChildViews.call(this);
  }, 'content'),

  /**
    @private
    @property {Function} needsSyncChildViews
  */
  needsSyncChildViews: Ember.observer(syncChildViews, 'height', 'width', 'columnCount'),

  /**
    @private

    Returns a new item view. Takes `contentIndex` to set the context
    of the returned view properly.

    @param {Number} contentIndex item index in the content array
    @method _addItemView
  */
  _addItemView: function(contentIndex){
    var itemViewClass, childView;

    itemViewClass = get(this, 'itemViewClass');
    childView = this.createChildView(itemViewClass);

    this.pushObject(childView);
   },

  /**
    @private

    Intelligently manages the number of childviews.

    @method _syncChildViews
   **/
  _syncChildViews: function(){
    var itemViewClass, startingIndex, childViewCount,
        endingIndex, numberOfChildViews, numberOfChildViewsNeeded,
        childViews, count, delta, index, childViewsLength, contentIndex;

    if (get(this, 'isDestroyed') || get(this, 'isDestroying')) {
      return;
    }

    childViewCount = this._childViewCount();
    childViews = this.positionOrderedChildViews();

    startingIndex = this._startingIndex();
    endingIndex = startingIndex + childViewCount;

    numberOfChildViewsNeeded = childViewCount;
    numberOfChildViews = childViews.length;

    delta = numberOfChildViewsNeeded - numberOfChildViews;

    if (delta === 0) {
      // no change
    } else if (delta > 0) {
      // more views are needed
      contentIndex = this._lastEndingIndex;

      for (count = 0; count < delta; count++, contentIndex++) {
        this._addItemView(contentIndex);
      }

    } else {
      // less views are needed
      forEach.call(
        childViews.splice(numberOfChildViewsNeeded, numberOfChildViews),
        removeAndDestroy,
        this
      );
    }

    this._scrollContentTo(get(this, 'scrollTop'));

    // if _scrollContentTo short-circuits, we still need
    // to call _reuseChildren to get new views positioned
    // and rendered correctly
    this._reuseChildren();

    this._lastStartingIndex = startingIndex;
    this._lastEndingIndex   = this._lastEndingIndex + delta;
  },

  /**
    @private
    @method _reuseChildren
  */
  _reuseChildren: function(){
    var contentLength, childViews, childViewsLength,
        startingIndex, endingIndex, childView, attrs,
        contentIndex, visibleEndingIndex, maxContentIndex,
        contentIndexEnd, scrollTop;

    scrollTop = get(this, 'scrollTop');
    contentLength = get(this, 'content.length');
    maxContentIndex = max(contentLength - 1, 0);
    childViews = this._childViews;
    childViewsLength =  childViews.length;

    startingIndex = this._startingIndex();
    visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

    endingIndex = min(maxContentIndex, visibleEndingIndex);

    this.trigger('scrollContentTo', scrollTop);

    contentIndexEnd = min(visibleEndingIndex, startingIndex + childViewsLength);

    for (contentIndex = startingIndex; contentIndex < contentIndexEnd; contentIndex++) {
      childView = childViews[contentIndex % childViewsLength];
      this._reuseChildForContentIndex(childView, contentIndex);
    }
  },

  /**
    @private
    @method positionOrderedChildViews
  */
  positionOrderedChildViews: function() {
    return this._childViews.sort(sortByContentIndex);
  },

  arrayWillChange: Ember.K,

  /**
    @private
    @event arrayDidChange
  */
  // TODO: refactor
  arrayDidChange: function(content, start, removedCount, addedCount) {
    var index, contentIndex;

    if (this.state === 'inDOM') {
      // ignore if all changes are out of the visible change
      if( start >= this._lastStartingIndex || start < this._lastEndingIndex) {
        index = 0;
        // ignore all changes not in the visible range
        // this can re-position many, rather then causing a cascade of re-renders
        forEach.call(
          this.positionOrderedChildViews(),
          function(childView) {
            contentIndex = this._lastStartingIndex + index;
            this._reuseChildForContentIndex(childView, contentIndex);
            index++;
          },
          this
        );
      }

      syncChildViews.call(this);
    }
  }
});

})();



(function() {
var get = Ember.get, set = Ember.set;

/**
  The `Ember.ListView` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element,
  with `ember-list-view` class.

  The context of each item element within the `Ember.ListView` are populated
  from the objects in the `Element.ListView`'s `content` property.

  ### `content` as an Array of Objects

  The simplest version of an `Ember.ListView` takes an array of object as its
  `content` property. The object will be used as the `context` each item element
  inside the rendered `div`.

  Example:

  ```javascript
  App.contributors = [{ name: 'Stefan Penner' }, { name: 'Alex Navasardyan' }, { name: 'Rey Cohen'}];
  ```

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  Would result in the following HTML:

  ```html
   <div id="ember181" class="ember-view ember-list-view" style="height:500px;width:500px;position:relative;overflow:scroll;-webkit-overflow-scrolling:touch;overflow-scrolling:touch;">
    <div class="ember-list-container">
      <div id="ember186" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 0px, 0);">
        <script id="metamorph-0-start" type="text/x-placeholder"></script>Stefan Penner<script id="metamorph-0-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember187" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 50px, 0);">
        <script id="metamorph-1-start" type="text/x-placeholder"></script>Alex Navasardyan<script id="metamorph-1-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember188" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 100px, 0);">
        <script id="metamorph-2-start" type="text/x-placeholder"></script>Rey Cohen<script id="metamorph-2-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember189" class="ember-view ember-list-scrolling-view" style="height: 150px"></div>
    </div>
  </div>
  ```

  By default `Ember.ListView` provides support for `height`,
  `rowHeight`, `width`, `elementWidth`, `scrollTop` parameters.

  Note, that `height` and `rowHeight` are required parameters.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  If you would like to have multiple columns in your view layout, you can
  set `width` and `elementWidth` parameters respectively.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50 width=500 elementWidth=80}}
    {{name}}
  {{/collection}}
  ```

  ### extending `Ember.ListView`

  Example:

  ```handlebars
  {{view App.ListView contentBinding="content"}}

  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    width: 500,
    elementWidth: 80,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.ContainerView
  @class ListView
  @namespace Ember
*/
Ember.ListView = Ember.ContainerView.extend(Ember.ListViewMixin, {
  css: {
    position: 'relative',
    overflow: 'scroll',
    '-webkit-overflow-scrolling': 'touch',
    'overflow-scrolling': 'touch'
  },

  applyTransform: Ember.ListViewHelper.applyTransform,

  _scrollTo: function(scrollTop) {
    var element = get(this, 'element');

    if (element) { element.scrollTop = scrollTop; }
  },

  didInsertElement: function() {
    var that, element;

    that = this,
    element = get(this, 'element');

    this._updateScrollableHeight();

    this._scroll = function(e) { that.scroll(e); };

    Ember.$(element).on('scroll', this._scroll);
  },

  willDestroyElement: function() {
    var element;

    element = get(this, 'element');

    Ember.$(element).off('scroll', this._scroll);
  },

  scroll: function(e) {
    Ember.run(this, this.scrollTo, e.target.scrollTop);
  },

  scrollTo: function(y){
    var element = get(this, 'element');
    this._scrollTo(y);
    this._scrollContentTo(y);
  },

  totalHeightDidChange: Ember.observer(function () {
    Ember.run.scheduleOnce('afterRender', this, this._updateScrollableHeight);
  }, 'totalHeight'),

  _updateScrollableHeight: function () {
    if (this.state === 'inDOM') {
      this.$('.ember-list-container').css({
        height: get(this, 'totalHeight')
      });
    }
  }
});

})();



(function() {
var fieldRegex = /input|textarea|select/i,
  hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof window.DocumentTouch,
  handleStart, handleMove, handleEnd, handleCancel,
  startEvent, moveEvent, endEvent, cancelEvent;
if (hasTouch) {
  startEvent = 'touchstart';
  handleStart = function (e) {
    var touch = e.touches[0],
      target = touch && touch.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll(e.touches, e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'touchmove';
  handleMove = function (e) {
    this.continueScroll(e.touches, e.timeStamp);
  };
  endEvent = 'touchend';
  handleEnd = function (e) {
    // if we didn't end up scrolling we need to
    // synthesize click since we did e.preventDefault()
    // on touchstart
    if (!this._isScrolling) {
      synthesizeClick(e);
    }
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'touchcancel';
  handleCancel = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
} else {
  startEvent = 'mousedown';
  handleStart = function (e) {
    if (e.which !== 1) return;
    var target = e.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll([e], e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'mousemove';
  handleMove = function (e) {
    this.continueScroll([e], e.timeStamp);
  };
  endEvent = 'mouseup';
  handleEnd = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'mouseout';
  handleCancel = function (e) {
    if (e.relatedTarget) return;
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
}

function handleWheel(e) {
  this.mouseWheel(e);
  e.preventDefault();
}

function bindElement(el, handlers) {
  el.addEventListener(startEvent, handlers.start, false);
  el.addEventListener('mousewheel', handlers.wheel, false);
}

function unbindElement(el, handlers) {
  el.removeEventListener(startEvent, handlers.start, false);
  el.removeEventListener('mousewheel', handlers.wheel, false);
}

function bindWindow(handlers) {
  window.addEventListener(moveEvent, handlers.move, true);
  window.addEventListener(endEvent, handlers.end, true);
  window.addEventListener(cancelEvent, handlers.cancel, true);
}

function unbindWindow(handlers) {
  window.removeEventListener(moveEvent, handlers.move, true);
  window.removeEventListener(endEvent, handlers.end, true);
  window.removeEventListener(cancelEvent, handlers.cancel, true);
}

Ember.VirtualListScrollerEvents = Ember.Mixin.create({
  init: function() {
    this.on('didInsertElement', this, 'bindScrollerEvents');
    this.on('willDestroyElement', this, 'unbindScrollerEvents');
    this.scrollerEventHandlers = {
      start: bind(this, handleStart),
      move: bind(this, handleMove),
      end: bind(this, handleEnd),
      cancel: bind(this, handleCancel),
      wheel: bind(this, handleWheel)
    };
    return this._super();
  },
  bindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    bindElement(el, handlers);
  },
  unbindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    unbindElement(el, handlers);
    unbindWindow(handlers);
  }
});

function bind(view, handler) {
  return function (evt) {
    handler.call(view, evt);
  };
}

function synthesizeClick(e) {
  var point = e.changedTouches[0],
    target = point.target,
    ev;
  if (target && fieldRegex.test(target.tagName)) {
    ev = document.createEvent('MouseEvents');
    ev.initMouseEvent('click', true, true, e.view, 1, point.screenX, point.screenY, point.clientX, point.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, null);
    return target.dispatchEvent(ev);
  }
}

})();



(function() {
/*global Scroller*/
var max = Math.max, get = Ember.get, set = Ember.set;

function updateScrollerDimensions(target) {
  var width, height, totalHeight;

  target = target || this;

  width = get(target, 'width');
  height = get(target, 'height');
  totalHeight = get(target, 'totalHeight');

  target.scroller.setDimensions(width, height, width, totalHeight);
  target.trigger('scrollerDimensionsDidChange');
}

/**
  VirtualListView

  @class VirtualListView
  @namespace Ember
*/
Ember.VirtualListView = Ember.ContainerView.extend(Ember.ListViewMixin, Ember.VirtualListScrollerEvents, {
  _isScrolling: false,
  _mouseWheel: null,
  css: {
    position: 'relative',
    overflow: 'hidden'
  },

  init: function(){
    this._super();
    this.setupScroller();
  },
  _scrollerTop: 0,
  applyTransform: Ember.ListViewHelper.apply3DTransform,

  setupScroller: function(){
    var view, y;

    view = this;

    view.scroller = new Scroller(function(left, top, zoom) {
      if (view.state !== 'inDOM') { return; }

      if (view.listContainerElement) {
        view.applyTransform(view.listContainerElement, 0, -top);
        view._scrollerTop = top;
        view._scrollContentTo(top);
      }
    }, {
      scrollingX: false,
      scrollingComplete: function(){
        view.trigger('scrollingDidComplete');
      }
    });

    view.trigger('didInitializeScroller');
    updateScrollerDimensions(view);
  },

  scrollerDimensionsNeedToChange: Ember.observer(function() {
    Ember.run.once(this, updateScrollerDimensions);
  }, 'width', 'height', 'totalHeight'),

  didInsertElement: function() {
    this.listContainerElement = this.$('> .ember-list-container')[0];
  },

  willBeginScroll: function(touches, timeStamp) {
    this._isScrolling = false;
    this.trigger('scrollingDidStart');

    this.scroller.doTouchStart(touches, timeStamp);
  },

  continueScroll: function(touches, timeStamp) {
    var startingScrollTop, endingScrollTop, event;

    if (this._isScrolling) {
      this.scroller.doTouchMove(touches, timeStamp);
    } else {
      startingScrollTop = this._scrollerTop;

      this.scroller.doTouchMove(touches, timeStamp);

      endingScrollTop = this._scrollerTop;

      if (startingScrollTop !== endingScrollTop) {
        event = Ember.$.Event("scrollerstart");
        Ember.$(touches[0].target).trigger(event);

        this._isScrolling = true;
      }
    }
  },

  endScroll: function(timeStamp) {
    this.scroller.doTouchEnd(timeStamp);
  },

  // api
  scrollTo: function(y, animate) {
    if (animate === undefined) {
      animate = true;
    }

    this.scroller.scrollTo(0, y, animate, 1);
  },

  // events
  mouseWheel: function(e){
    var inverted, delta, candidatePosition;

    inverted = e.webkitDirectionInvertedFromDevice;
    delta = e.wheelDeltaY * (inverted ? 0.8 : -0.8);
    candidatePosition = this.scroller.__scrollTop + delta;

    if ((candidatePosition >= 0) && (candidatePosition <= this.scroller.__maxScrollTop)) {
      this.scroller.scrollBy(0, delta, true);
    }

    return false;
  }
});

})();



(function() {

})();

define("admin/controllers/admin-email-skipped", 
  ["discourse/controllers/controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DiscourseController = __dependency1__["default"];

    __exports__["default"] = DiscourseController.extend({
      filterEmailLogs: Discourse.debounce(function() {
        var self = this;
        Discourse.EmailLog.findAll(this.get("filter")).then(function(logs) {
          self.set("model", logs);
        });
      }, 250).observes("filter.user", "filter.address", "filter.type", "filter.skipped_reason")
    });
  });

Discourse.AdminEmailSkippedController = require('admin/controllers/admin-email-skipped').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-email-skipped.js'] = "define(\"admin/controllers/admin-email-skipped\", \n  [\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var DiscourseController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = DiscourseController.extend({\n      filterEmailLogs: Discourse.debounce(function() {\n        var self = this;\n        Discourse.EmailLog.findAll(this.get(\"filter\")).then(function(logs) {\n          self.set(\"model\", logs);\n        });\n      }, 250).observes(\"filter.user\", \"filter.address\", \"filter.type\", \"filter.skipped_reason\")\n    });\n  });";
define("admin/controllers/change-site-customization-details", 
  ["discourse/mixins/modal-functionality","discourse/controllers/object","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];

    var ObjectController = __dependency2__["default"];

    __exports__["default"] = ObjectController.extend(ModalFunctionality, {
      previousSelected: Ember.computed.equal('selectedTab', 'previous'),
      newSelected:      Ember.computed.equal('selectedTab', 'new'),

      onShow: function() {
        this.selectNew();
      },

      selectNew: function() {
        this.set('selectedTab', 'new');
      },

      selectPrevious: function() {
        this.set('selectedTab', 'previous');
      }
    });
  });

Discourse.ChangeSiteCustomizationDetailsController = require('admin/controllers/change-site-customization-details').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/change-site-customization-details.js'] = "define(\"admin/controllers/change-site-customization-details\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n\n    var ObjectController = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = ObjectController.extend(ModalFunctionality, {\n      previousSelected: Ember.computed.equal('selectedTab', 'previous'),\n      newSelected:      Ember.computed.equal('selectedTab', 'new'),\n\n      onShow: function() {\n        this.selectNew();\n      },\n\n      selectNew: function() {\n        this.set('selectedTab', 'new');\n      },\n\n      selectPrevious: function() {\n        this.set('selectedTab', 'previous');\n      }\n    });\n  });";
define("admin/components/admin-group-selector", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Component.extend({
      tagName: 'div',

      didInsertElement: function(){
        this.$("input").select2({
            multiple: true,
            width: '100%',
            query: function(opts){
                    opts.callback({
                      results: this.get("available").map(this._format)
                    });
                  }.bind(this)
          }).on("change", function(evt) {
            if (evt.added){
              this.triggerAction({action: "groupAdded",
                    actionContext: this.get("available"
                                        ).findBy("id", evt.added.id)});
            } else if (evt.removed) {
              this.triggerAction({action:"groupRemoved",
                    actionContext: this.get("selected"
                                        ).findBy("id", evt.removed.id)});
            }
          }.bind(this));
        this._refreshOnReset();
      },

      _format: function(item){
        return {"text": item.name, "id": item.id, "locked": item.automatic};
      },

      _refreshOnReset: function() {
        this.$("input").select2("data", this.get("selected").map(this._format));
      }.observes("selected")
    });
  });

Discourse.AdminGroupSelectorComponent = require('admin/components/admin-group-selector').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/admin-group-selector.js'] = "define(\"admin/components/admin-group-selector\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.Component.extend({\n      tagName: 'div',\n\n      didInsertElement: function(){\n        this.$(\"input\").select2({\n            multiple: true,\n            width: '100%',\n            query: function(opts){\n                    opts.callback({\n                      results: this.get(\"available\").map(this._format)\n                    });\n                  }.bind(this)\n          }).on(\"change\", function(evt) {\n            if (evt.added){\n              this.triggerAction({action: \"groupAdded\",\n                    actionContext: this.get(\"available\"\n                                        ).findBy(\"id\", evt.added.id)});\n            } else if (evt.removed) {\n              this.triggerAction({action:\"groupRemoved\",\n                    actionContext: this.get(\"selected\"\n                                        ).findBy(\"id\", evt.removed.id)});\n            }\n          }.bind(this));\n        this._refreshOnReset();\n      },\n\n      _format: function(item){\n        return {\"text\": item.name, \"id\": item.id, \"locked\": item.automatic};\n      },\n\n      _refreshOnReset: function() {\n        this.$(\"input\").select2(\"data\", this.get(\"selected\").map(this._format));\n      }.observes(\"selected\")\n    });\n  });";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  An input field for a color.

  @param hexValue is a reference to the color's hex value.
  @param brightnessValue is a number from 0 to 255 representing the brightness of the color. See ColorSchemeColor.
  @params valid is a boolean indicating if the input field is a valid color.

  @class Discourse.ColorInputComponent
  @extends Ember.Component
  @namespace Discourse
  @module Discourse
 **/

Discourse.ColorInputComponent = Ember.Component.extend({
  layoutName: 'components/color-input',

  hexValueChanged: function() {
    var hex = this.get('hexValue');
    if (this.get('valid')) {
      this.$('input').attr('style', 'color: ' + (this.get('brightnessValue') > 125 ? 'black' : 'white') + '; background-color: #' + hex + ';');
    } else {
      this.$('input').attr('style', '');
    }
  }.observes('hexValue', 'brightnessValue', 'valid'),

  didInsertElement: function() {
    var self = this;
    this._super();
    Em.run.schedule('afterRender', function() {
      self.hexValueChanged();
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/color_input_component.js'] = "/**\n  An input field for a color.\n\n  @param hexValue is a reference to the color's hex value.\n  @param brightnessValue is a number from 0 to 255 representing the brightness of the color. See ColorSchemeColor.\n  @params valid is a boolean indicating if the input field is a valid color.\n\n  @class Discourse.ColorInputComponent\n  @extends Ember.Component\n  @namespace Discourse\n  @module Discourse\n **/\n\nDiscourse.ColorInputComponent = Ember.Component.extend({\n  layoutName: 'components/color-input',\n\n  hexValueChanged: function() {\n    var hex = this.get('hexValue');\n    if (this.get('valid')) {\n      this.$('input').attr('style', 'color: ' + (this.get('brightnessValue') \u003e 125 ? 'black' : 'white') + '; background-color: #' + hex + ';');\n    } else {\n      this.$('input').attr('style', '');\n    }\n  }.observes('hexValue', 'brightnessValue', 'valid'),\n\n  didInsertElement: function() {\n    var self = this;\n    this._super();\n    Em.run.schedule('afterRender', function() {\n      self.hexValueChanged();\n    });\n  }\n});\n";
define("admin/components/ip-lookup", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Component.extend({
      classNames: ["ip-lookup"],

      city: function () {
        return [
          this.get("location.city"),
          this.get("location.region"),
          this.get("location.country")
        ].filter(Boolean).join(", ");
      }.property("location.{city,region,country}"),

      actions: {
        lookup: function () {
          var self = this;
          this.set("show", true);

          if (!this.get("location")) {
            Discourse.ajax("/admin/users/ip-info.json", {
              data: { ip: this.get("ip") }
            }).then(function (location) {
              self.set("location", Em.Object.create(location));
            });
          }

          if (!this.get("other_accounts")) {
            this.set("other_accounts_loading", true);
            Discourse.AdminUser.findAll("active", {
              "ip": this.get("ip"),
              "exclude": this.get("user_id")
            }).then(function (users) {
              self.setProperties({
                other_accounts: users,
                other_accounts_loading: false,
              });
            });
          }
        },

        hide: function () {
          this.set("show", false);
        }
      }
    });
  });

Discourse.IpLookupComponent = require('admin/components/ip-lookup').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/ip-lookup.js'] = "define(\"admin/components/ip-lookup\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.Component.extend({\n      classNames: [\"ip-lookup\"],\n\n      city: function () {\n        return [\n          this.get(\"location.city\"),\n          this.get(\"location.region\"),\n          this.get(\"location.country\")\n        ].filter(Boolean).join(\", \");\n      }.property(\"location.{city,region,country}\"),\n\n      actions: {\n        lookup: function () {\n          var self = this;\n          this.set(\"show\", true);\n\n          if (!this.get(\"location\")) {\n            Discourse.ajax(\"/admin/users/ip-info.json\", {\n              data: { ip: this.get(\"ip\") }\n            }).then(function (location) {\n              self.set(\"location\", Em.Object.create(location));\n            });\n          }\n\n          if (!this.get(\"other_accounts\")) {\n            this.set(\"other_accounts_loading\", true);\n            Discourse.AdminUser.findAll(\"active\", {\n              \"ip\": this.get(\"ip\"),\n              \"exclude\": this.get(\"user_id\")\n            }).then(function (users) {\n              self.setProperties({\n                other_accounts: users,\n                other_accounts_loading: false,\n              });\n            });\n          }\n        },\n\n        hide: function () {\n          this.set(\"show\", false);\n        }\n      }\n    });\n  });";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Provide a nice GUI for a pipe-delimited list in the site settings.

  @param settingValue is a reference to SiteSetting.value.
  @param choices is a reference to SiteSetting.choices

  @class Discourse.ListSettingComponent
  @extends Ember.Component
  @namespace Discourse
  @module Discourse
 **/


Discourse.ListSettingComponent = Ember.Component.extend({
  tagName: 'div',


  _select2FormatSelection: function(selectedObject, jqueryWrapper, htmlEscaper) {
    var text = selectedObject.text;
    if (text.length <= 6) {
      jqueryWrapper.closest('li.select2-search-choice').css({"border-bottom": '7px solid #'+text});
    }
    return htmlEscaper(text);
  },

  didInsertElement: function(){

    var select2_options = {
      multiple: false,
      separator: "|",
      tokenSeparators: ["|"],
      tags : this.get("choices") || [],
      width: 'off',
      dropdownCss: this.get("choices") ? {} : {display: 'none'}
    };

    var settingName = this.get('settingName');
    if (typeof settingName === 'string' && settingName.indexOf('colors') > -1) {
      select2_options.formatSelection = this._select2FormatSelection;
    }
    this.$("input").select2(select2_options).on("change", function(obj) {
        this.set("settingValue", obj.val.join("|"));
        this.refreshSortables();
      }.bind(this));

    this.refreshSortables();
  },

  refreshOnReset: function() {
    this.$("input").select2("val", this.get("settingValue").split("|"));
  }.observes("settingValue"),

  refreshSortables: function() {
    this.$("ul.select2-choices").sortable().on('sortupdate', function() {
      this.$("input").select2("onSortEnd");
    }.bind(this));
  }
});




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/list_setting_component.js'] = "/**\n  Provide a nice GUI for a pipe-delimited list in the site settings.\n\n  @param settingValue is a reference to SiteSetting.value.\n  @param choices is a reference to SiteSetting.choices\n\n  @class Discourse.ListSettingComponent\n  @extends Ember.Component\n  @namespace Discourse\n  @module Discourse\n **/\n\n\nDiscourse.ListSettingComponent = Ember.Component.extend({\n  tagName: 'div',\n\n\n  _select2FormatSelection: function(selectedObject, jqueryWrapper, htmlEscaper) {\n    var text = selectedObject.text;\n    if (text.length \u003c= 6) {\n      jqueryWrapper.closest('li.select2-search-choice').css({\"border-bottom\": '7px solid #'+text});\n    }\n    return htmlEscaper(text);\n  },\n\n  didInsertElement: function(){\n\n    var select2_options = {\n      multiple: false,\n      separator: \"|\",\n      tokenSeparators: [\"|\"],\n      tags : this.get(\"choices\") || [],\n      width: 'off',\n      dropdownCss: this.get(\"choices\") ? {} : {display: 'none'}\n    };\n\n    var settingName = this.get('settingName');\n    if (typeof settingName === 'string' \u0026\u0026 settingName.indexOf('colors') \u003e -1) {\n      select2_options.formatSelection = this._select2FormatSelection;\n    }\n    this.$(\"input\").select2(select2_options).on(\"change\", function(obj) {\n        this.set(\"settingValue\", obj.val.join(\"|\"));\n        this.refreshSortables();\n      }.bind(this));\n\n    this.refreshSortables();\n  },\n\n  refreshOnReset: function() {\n    this.$(\"input\").select2(\"val\", this.get(\"settingValue\").split(\"|\"));\n  }.observes(\"settingValue\"),\n\n  refreshSortables: function() {\n    this.$(\"ul.select2-choices\").sortable().on('sortupdate', function() {\n      this.$(\"input\").select2(\"onSortEnd\");\n    }.bind(this));\n  }\n});\n\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/*global Resumable:true */

/**
  Example usage:

    {{resumable-upload
        target="/admin/backups/upload"
        success="successAction"
        error="errorAction"
        uploadText="UPLOAD"
    }}

  @class ResumableUploadComponent
  @extends Ember.Component
  @namespace Discourse
  @module Discourse
**/

Discourse.ResumableUploadComponent = Ember.Component.extend({
  tagName: "button",
  classNames: ["btn", "ru"],
  classNameBindings: ["isUploading"],

  resumable: null,

  isUploading: false,
  progress: 0,

  shouldRerender: Discourse.View.renderIfChanged("isUploading", "progress"),

  text: function() {
    if (this.get("isUploading")) {
      return this.get("progress") + " %";
    } else {
      return this.get("uploadText");
    }
  }.property("isUploading", "progress"),

  render: function(buffer) {
    var icon = this.get("isUploading") ? "times" : "upload";
    buffer.push("<i class='fa fa-" + icon + "'></i>");
    buffer.push("<span class='ru-label'>" + this.get("text") + "</span>");
    buffer.push("<span class='ru-progress' style='width:" + this.get("progress") + "%'></span>");
  },

  click: function() {
    if (this.get("isUploading")) {
      this.resumable.cancel();
      var self = this;
      Em.run.later(function() { self._reset(); });
      return false;
    } else {
      return true;
    }
  },

  _reset: function() {
    this.setProperties({ isUploading: false, progress: 0 });
  },

  _initialize: function() {
    this.resumable = new Resumable({
      target: this.get("target"),
      maxFiles: 1, // only 1 file at a time
      headers: { "X-CSRF-Token": $("meta[name='csrf-token']").attr("content") }
    });

    var self = this;

    this.resumable.on("fileAdded", function() {
      // automatically upload the selected file
      self.resumable.upload();
      // mark as uploading
      Em.run.later(function() {
        self.set("isUploading", true);
      });
    });

    this.resumable.on("fileProgress", function(file) {
      // update progress
      Em.run.later(function() {
        self.set("progress", parseInt(file.progress() * 100, 10));
      });
    });

    this.resumable.on("fileSuccess", function(file) {
      Em.run.later(function() {
        // mark as not uploading anymore
        self._reset();
        // fire an event to allow the parent route to reload its model
        self.sendAction("success", file.fileName);
      });
    });

    this.resumable.on("fileError", function(file, message) {
      Em.run.later(function() {
        // mark as not uploading anymore
        self._reset();
        // fire an event to allow the parent route to display the error message
        self.sendAction("error", file.fileName, message);
      });
    });

  }.on("init"),

  _assignBrowse: function() {
    var self = this;
    Em.run.schedule("afterRender", function() {
      self.resumable.assignBrowse(self.$());
    });
  }.on("didInsertElement"),

  _teardown: function() {
    if (this.resumable) {
      this.resumable.cancel();
      this.resumable = null;
    }
  }.on("willDestroyElement")

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/resumable_upload_component.js'] = "/*global Resumable:true */\n\n/**\n  Example usage:\n\n    {{resumable-upload\n        target=\"/admin/backups/upload\"\n        success=\"successAction\"\n        error=\"errorAction\"\n        uploadText=\"UPLOAD\"\n    }}\n\n  @class ResumableUploadComponent\n  @extends Ember.Component\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ResumableUploadComponent = Ember.Component.extend({\n  tagName: \"button\",\n  classNames: [\"btn\", \"ru\"],\n  classNameBindings: [\"isUploading\"],\n\n  resumable: null,\n\n  isUploading: false,\n  progress: 0,\n\n  shouldRerender: Discourse.View.renderIfChanged(\"isUploading\", \"progress\"),\n\n  text: function() {\n    if (this.get(\"isUploading\")) {\n      return this.get(\"progress\") + \" %\";\n    } else {\n      return this.get(\"uploadText\");\n    }\n  }.property(\"isUploading\", \"progress\"),\n\n  render: function(buffer) {\n    var icon = this.get(\"isUploading\") ? \"times\" : \"upload\";\n    buffer.push(\"\u003ci class='fa fa-\" + icon + \"'\u003e\u003c/i\u003e\");\n    buffer.push(\"\u003cspan class='ru-label'\u003e\" + this.get(\"text\") + \"\u003c/span\u003e\");\n    buffer.push(\"\u003cspan class='ru-progress' style='width:\" + this.get(\"progress\") + \"%'\u003e\u003c/span\u003e\");\n  },\n\n  click: function() {\n    if (this.get(\"isUploading\")) {\n      this.resumable.cancel();\n      var self = this;\n      Em.run.later(function() { self._reset(); });\n      return false;\n    } else {\n      return true;\n    }\n  },\n\n  _reset: function() {\n    this.setProperties({ isUploading: false, progress: 0 });\n  },\n\n  _initialize: function() {\n    this.resumable = new Resumable({\n      target: this.get(\"target\"),\n      maxFiles: 1, // only 1 file at a time\n      headers: { \"X-CSRF-Token\": $(\"meta[name='csrf-token']\").attr(\"content\") }\n    });\n\n    var self = this;\n\n    this.resumable.on(\"fileAdded\", function() {\n      // automatically upload the selected file\n      self.resumable.upload();\n      // mark as uploading\n      Em.run.later(function() {\n        self.set(\"isUploading\", true);\n      });\n    });\n\n    this.resumable.on(\"fileProgress\", function(file) {\n      // update progress\n      Em.run.later(function() {\n        self.set(\"progress\", parseInt(file.progress() * 100, 10));\n      });\n    });\n\n    this.resumable.on(\"fileSuccess\", function(file) {\n      Em.run.later(function() {\n        // mark as not uploading anymore\n        self._reset();\n        // fire an event to allow the parent route to reload its model\n        self.sendAction(\"success\", file.fileName);\n      });\n    });\n\n    this.resumable.on(\"fileError\", function(file, message) {\n      Em.run.later(function() {\n        // mark as not uploading anymore\n        self._reset();\n        // fire an event to allow the parent route to display the error message\n        self.sendAction(\"error\", file.fileName, message);\n      });\n    });\n\n  }.on(\"init\"),\n\n  _assignBrowse: function() {\n    var self = this;\n    Em.run.schedule(\"afterRender\", function() {\n      self.resumable.assignBrowse(self.$());\n    });\n  }.on(\"didInsertElement\"),\n\n  _teardown: function() {\n    if (this.resumable) {\n      this.resumable.cancel();\n      this.resumable = null;\n    }\n  }.on(\"willDestroyElement\")\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A form to create an IP address that will be blocked or whitelisted.
  Example usage:

    {{screened-ip-address-form action="recordAdded"}}

  where action is a callback on the controller or route that will get called after
  the new record is successfully saved. It is called with the new ScreenedIpAddress record
  as an argument.

  @class ScreenedIpAddressFormComponent
  @extends Ember.Component
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedIpAddressFormComponent = Ember.Component.extend({
  classNames: ['screened-ip-address-form'],
  formSubmitted: false,
  actionName: 'block',

  actionNames: function() {
    return [
      {id: 'block',       name: I18n.t('admin.logs.screened_ips.actions.block')},
      {id: 'do_nothing',  name: I18n.t('admin.logs.screened_ips.actions.do_nothing')}
    ];
  }.property(),

  actions: {
    submit: function() {
      if (!this.get('formSubmitted')) {
        var self = this;
        this.set('formSubmitted', true);
        var screenedIpAddress = Discourse.ScreenedIpAddress.create({ip_address: this.get('ip_address'), action_name: this.get('actionName')});
        screenedIpAddress.save().then(function(result) {
          self.set('ip_address', '');
          self.set('formSubmitted', false);
          self.sendAction('action', Discourse.ScreenedIpAddress.create(result.screened_ip_address));
          Em.run.schedule('afterRender', function() { self.$('.ip-address-input').focus(); });
        }, function(e) {
          self.set('formSubmitted', false);
          var msg;
          if (e.responseJSON && e.responseJSON.errors) {
            msg = I18n.t("generic_error_with_reason", {error: e.responseJSON.errors.join('. ')});
          } else {
            msg = I18n.t("generic_error");
          }
          bootbox.alert(msg, function() { self.$('.ip-address-input').focus(); });
        });
      }
    }
  },

  didInsertElement: function() {
    var self = this;
    this._super();
    Em.run.schedule('afterRender', function() {
      self.$('.ip-address-input').keydown(function(e) {
        if (e.keyCode === 13) { // enter key
          self.send('submit');
        }
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/components/screened_ip_address_form_component.js'] = "/**\n  A form to create an IP address that will be blocked or whitelisted.\n  Example usage:\n\n    {{screened-ip-address-form action=\"recordAdded\"}}\n\n  where action is a callback on the controller or route that will get called after\n  the new record is successfully saved. It is called with the new ScreenedIpAddress record\n  as an argument.\n\n  @class ScreenedIpAddressFormComponent\n  @extends Ember.Component\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ScreenedIpAddressFormComponent = Ember.Component.extend({\n  classNames: ['screened-ip-address-form'],\n  formSubmitted: false,\n  actionName: 'block',\n\n  actionNames: function() {\n    return [\n      {id: 'block',       name: I18n.t('admin.logs.screened_ips.actions.block')},\n      {id: 'do_nothing',  name: I18n.t('admin.logs.screened_ips.actions.do_nothing')}\n    ];\n  }.property(),\n\n  actions: {\n    submit: function() {\n      if (!this.get('formSubmitted')) {\n        var self = this;\n        this.set('formSubmitted', true);\n        var screenedIpAddress = Discourse.ScreenedIpAddress.create({ip_address: this.get('ip_address'), action_name: this.get('actionName')});\n        screenedIpAddress.save().then(function(result) {\n          self.set('ip_address', '');\n          self.set('formSubmitted', false);\n          self.sendAction('action', Discourse.ScreenedIpAddress.create(result.screened_ip_address));\n          Em.run.schedule('afterRender', function() { self.$('.ip-address-input').focus(); });\n        }, function(e) {\n          self.set('formSubmitted', false);\n          var msg;\n          if (e.responseJSON \u0026\u0026 e.responseJSON.errors) {\n            msg = I18n.t(\"generic_error_with_reason\", {error: e.responseJSON.errors.join('. ')});\n          } else {\n            msg = I18n.t(\"generic_error\");\n          }\n          bootbox.alert(msg, function() { self.$('.ip-address-input').focus(); });\n        });\n      }\n    }\n  },\n\n  didInsertElement: function() {\n    var self = this;\n    this._super();\n    Em.run.schedule('afterRender', function() {\n      self.$('.ip-address-input').keydown(function(e) {\n        if (e.keyCode === 13) { // enter key\n          self.send('submit');\n        }\n      });\n    });\n  }\n});\n";
define("admin/controllers/admin-agree-flag", 
  ["discourse/mixins/modal-functionality","discourse/controllers/object","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];
    var ObjectController = __dependency2__["default"];

    __exports__["default"] = ObjectController.extend(ModalFunctionality, {

      needs: ["adminFlags"],

      actions: {

        agreeFlagHidePost: function () {
          var adminFlagController = this.get("controllers.adminFlags");
          var post = this.get("content");
          var self = this;

          return post.agreeFlags("hide").then(function () {
            adminFlagController.removeObject(post);
            self.send("closeModal");
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        },

        agreeFlagKeepPost: function () {
          var adminFlagController = this.get("controllers.adminFlags");
          var post = this.get("content");
          var self = this;

          return post.agreeFlags("keep").then(function () {
            adminFlagController.removeObject(post);
            self.send("closeModal");
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        }

      }

    });
  });

Discourse.AdminAgreeFlagController = require('admin/controllers/admin-agree-flag').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-agree-flag.js'] = "define(\"admin/controllers/admin-agree-flag\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n    var ObjectController = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = ObjectController.extend(ModalFunctionality, {\n\n      needs: [\"adminFlags\"],\n\n      actions: {\n\n        agreeFlagHidePost: function () {\n          var adminFlagController = this.get(\"controllers.adminFlags\");\n          var post = this.get(\"content\");\n          var self = this;\n\n          return post.agreeFlags(\"hide\").then(function () {\n            adminFlagController.removeObject(post);\n            self.send(\"closeModal\");\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        },\n\n        agreeFlagKeepPost: function () {\n          var adminFlagController = this.get(\"controllers.adminFlags\");\n          var post = this.get(\"content\");\n          var self = this;\n\n          return post.agreeFlags(\"keep\").then(function () {\n            adminFlagController.removeObject(post);\n            self.send(\"closeModal\");\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        }\n\n      }\n\n    });\n  });";
define("admin/controllers/admin-api", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for dealing with API keys

      @class AdminApiController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({

      actions: {
        /**
          Generates a master api key

          @method generateMasterKey
        **/
        generateMasterKey: function() {
          var self = this;
          Discourse.ApiKey.generateMasterKey().then(function (key) {
            self.get('model').pushObject(key);
          });
        },

        /**
          Creates an API key instance with internal user object

          @method regenerateKey
          @param {Discourse.ApiKey} key the key to regenerate
        **/
        regenerateKey: function(key) {
          bootbox.confirm(I18n.t("admin.api.confirm_regen"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              key.regenerate();
            }
          });
        },

        /**
          Revokes an API key

          @method revokeKey
          @param {Discourse.ApiKey} key the key to revoke
        **/
        revokeKey: function(key) {
          var self = this;
          bootbox.confirm(I18n.t("admin.api.confirm_revoke"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              key.revoke().then(function() {
                self.get('model').removeObject(key);
              });
            }
          });
        }
      },

      /**
        Has a master key already been generated?

        @property hasMasterKey
        @type {Boolean}
      **/
      hasMasterKey: function() {
        return !!this.get('model').findBy('user', null);
      }.property('model.@each')

    });
  });

Discourse.AdminApiController = require('admin/controllers/admin-api').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-api.js'] = "define(\"admin/controllers/admin-api\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for dealing with API keys\n\n      @class AdminApiController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n\n      actions: {\n        /**\n          Generates a master api key\n\n          @method generateMasterKey\n        **/\n        generateMasterKey: function() {\n          var self = this;\n          Discourse.ApiKey.generateMasterKey().then(function (key) {\n            self.get('model').pushObject(key);\n          });\n        },\n\n        /**\n          Creates an API key instance with internal user object\n\n          @method regenerateKey\n          @param {Discourse.ApiKey} key the key to regenerate\n        **/\n        regenerateKey: function(key) {\n          bootbox.confirm(I18n.t(\"admin.api.confirm_regen\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              key.regenerate();\n            }\n          });\n        },\n\n        /**\n          Revokes an API key\n\n          @method revokeKey\n          @param {Discourse.ApiKey} key the key to revoke\n        **/\n        revokeKey: function(key) {\n          var self = this;\n          bootbox.confirm(I18n.t(\"admin.api.confirm_revoke\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              key.revoke().then(function() {\n                self.get('model').removeObject(key);\n              });\n            }\n          });\n        }\n      },\n\n      /**\n        Has a master key already been generated?\n\n        @property hasMasterKey\n        @type {Boolean}\n      **/\n      hasMasterKey: function() {\n        return !!this.get('model').findBy('user', null);\n      }.property('model.@each')\n\n    });\n  });";
define("admin/controllers/admin-backups-index", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ArrayController.extend({
      needs: ["adminBackups"],
      status: Em.computed.alias("controllers.adminBackups"),

      uploadText: function() { return I18n.t("admin.backups.upload.text"); }.property(),

      readOnlyModeDisabled: Em.computed.alias("status.isOperationRunning"),

      restoreDisabled: Em.computed.alias("status.restoreDisabled"),

      restoreTitle: function() {
        if (!this.get('status.allowRestore')) {
          return I18n.t("admin.backups.operations.restore.is_disabled");
        } else if (this.get("status.isOperationRunning")) {
          return I18n.t("admin.backups.operation_already_running");
        } else {
          return I18n.t("admin.backups.operations.restore.title");
        }
      }.property("status.isOperationRunning"),

      destroyDisabled: Em.computed.alias("status.isOperationRunning"),

      destroyTitle: function() {
        if (this.get("status.isOperationRunning")) {
          return I18n.t("admin.backups.operation_already_running");
        } else {
          return I18n.t("admin.backups.operations.destroy.title");
        }
      }.property("status.isOperationRunning"),

      readOnlyModeTitle: function() { return this._readOnlyModeI18n("title"); }.property("Discourse.isReadOnly"),
      readOnlyModeText: function() { return this._readOnlyModeI18n("text"); }.property("Discourse.isReadOnly"),

      _readOnlyModeI18n: function(value) {
        var action = Discourse.get("isReadOnly") ? "disable" : "enable";
        return I18n.t("admin.backups.read_only." + action + "." + value);
      },

      actions: {

        /**
          Toggle read-only mode

          @method toggleReadOnlyMode
        **/
        toggleReadOnlyMode: function() {
          var self = this;
          if (!Discourse.get("isReadOnly")) {
            bootbox.confirm(
              I18n.t("admin.backups.read_only.enable.confirm"),
              I18n.t("no_value"),
              I18n.t("yes_value"),
              function(confirmed) {
                if (confirmed) {
                  Discourse.User.currentProp("hideReadOnlyAlert", true);
                  self._toggleReadOnlyMode(true);
                }
              }
            );
          } else {
            this._toggleReadOnlyMode(false);
          }
        }

      },

      _toggleReadOnlyMode: function(enable) {
        Discourse.ajax("/admin/backups/readonly", {
          type: "PUT",
          data: { enable: enable }
        }).then(function() {
          Discourse.set("isReadOnly", enable);
        });
      }
    });
  });

Discourse.AdminBackupsIndexController = require('admin/controllers/admin-backups-index').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-backups-index.js'] = "define(\"admin/controllers/admin-backups-index\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      needs: [\"adminBackups\"],\n      status: Em.computed.alias(\"controllers.adminBackups\"),\n\n      uploadText: function() { return I18n.t(\"admin.backups.upload.text\"); }.property(),\n\n      readOnlyModeDisabled: Em.computed.alias(\"status.isOperationRunning\"),\n\n      restoreDisabled: Em.computed.alias(\"status.restoreDisabled\"),\n\n      restoreTitle: function() {\n        if (!this.get('status.allowRestore')) {\n          return I18n.t(\"admin.backups.operations.restore.is_disabled\");\n        } else if (this.get(\"status.isOperationRunning\")) {\n          return I18n.t(\"admin.backups.operation_already_running\");\n        } else {\n          return I18n.t(\"admin.backups.operations.restore.title\");\n        }\n      }.property(\"status.isOperationRunning\"),\n\n      destroyDisabled: Em.computed.alias(\"status.isOperationRunning\"),\n\n      destroyTitle: function() {\n        if (this.get(\"status.isOperationRunning\")) {\n          return I18n.t(\"admin.backups.operation_already_running\");\n        } else {\n          return I18n.t(\"admin.backups.operations.destroy.title\");\n        }\n      }.property(\"status.isOperationRunning\"),\n\n      readOnlyModeTitle: function() { return this._readOnlyModeI18n(\"title\"); }.property(\"Discourse.isReadOnly\"),\n      readOnlyModeText: function() { return this._readOnlyModeI18n(\"text\"); }.property(\"Discourse.isReadOnly\"),\n\n      _readOnlyModeI18n: function(value) {\n        var action = Discourse.get(\"isReadOnly\") ? \"disable\" : \"enable\";\n        return I18n.t(\"admin.backups.read_only.\" + action + \".\" + value);\n      },\n\n      actions: {\n\n        /**\n          Toggle read-only mode\n\n          @method toggleReadOnlyMode\n        **/\n        toggleReadOnlyMode: function() {\n          var self = this;\n          if (!Discourse.get(\"isReadOnly\")) {\n            bootbox.confirm(\n              I18n.t(\"admin.backups.read_only.enable.confirm\"),\n              I18n.t(\"no_value\"),\n              I18n.t(\"yes_value\"),\n              function(confirmed) {\n                if (confirmed) {\n                  Discourse.User.currentProp(\"hideReadOnlyAlert\", true);\n                  self._toggleReadOnlyMode(true);\n                }\n              }\n            );\n          } else {\n            this._toggleReadOnlyMode(false);\n          }\n        }\n\n      },\n\n      _toggleReadOnlyMode: function(enable) {\n        Discourse.ajax(\"/admin/backups/readonly\", {\n          type: \"PUT\",\n          data: { enable: enable }\n        }).then(function() {\n          Discourse.set(\"isReadOnly\", enable);\n        });\n      }\n    });\n  });";
define("admin/controllers/admin-backups-logs", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ArrayController.extend({
      needs: ["adminBackups"],
      status: Em.computed.alias("controllers.adminBackups")
    });
  });

Discourse.AdminBackupsLogsController = require('admin/controllers/admin-backups-logs').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-backups-logs.js'] = "define(\"admin/controllers/admin-backups-logs\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      needs: [\"adminBackups\"],\n      status: Em.computed.alias(\"controllers.adminBackups\")\n    });\n  });";
define("admin/controllers/admin-backups", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ObjectController.extend({
      noOperationIsRunning: Em.computed.not("isOperationRunning"),
      rollbackEnabled: Em.computed.and("canRollback", "restoreEnabled", "noOperationIsRunning"),
      rollbackDisabled: Em.computed.not("rollbackEnabled")
    });
  });

Discourse.AdminBackupsController = require('admin/controllers/admin-backups').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-backups.js'] = "define(\"admin/controllers/admin-backups\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ObjectController.extend({\n      noOperationIsRunning: Em.computed.not(\"isOperationRunning\"),\n      rollbackEnabled: Em.computed.and(\"canRollback\", \"restoreEnabled\", \"noOperationIsRunning\"),\n      rollbackDisabled: Em.computed.not(\"rollbackEnabled\")\n    });\n  });";
define("admin/controllers/admin-badge-preview", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Controller.extend({
      needs: ['modal'],

      sample: Em.computed.alias('model.sample'),
      errors: Em.computed.alias('model.errors'),
      count: Em.computed.alias('model.grant_count'),

      count_warning: function() {
        if (this.get('count') <= 10) {
          return this.get('sample.length') !== this.get('count');
        } else {
          return this.get('sample.length') !== 10;
        }
      }.property('count', 'sample.length'),

      has_query_plan: function() {
        return !!this.get('model.query_plan');
      }.property('model.query_plan'),

      query_plan_html: function() {
        var raw = this.get('model.query_plan'),
            returned = "<pre class='badge-query-plan'>";

        _.each(raw, function(linehash) {
          returned += Handlebars.Utils.escapeExpression(linehash["QUERY PLAN"]);
          returned += "<br>";
        });

        returned += "</pre>";
        return returned;
      }.property('model.query_plan'),

      processed_sample: Ember.computed.map('model.sample', function(grant) {
        var i18nKey = 'admin.badges.preview.grant.with',
            i18nParams = { username: Handlebars.Utils.escapeExpression(grant.username) };

        if (grant.post_id) {
          i18nKey += "_post";
          i18nParams.link = "<a href='/p/" + grant.post_id + "' data-auto-route='true'>" + Handlebars.Utils.escapeExpression(grant.title) + "</a>";
        }

        if (grant.granted_at) {
          i18nKey += "_time";
          i18nParams.time = Handlebars.Utils.escapeExpression(moment(grant.granted_at).format(I18n.t('dates.long_with_year')));
        }

        return I18n.t(i18nKey, i18nParams);
      })
    });
  });

Discourse.AdminBadgePreviewController = require('admin/controllers/admin-badge-preview').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-badge-preview.js'] = "define(\"admin/controllers/admin-badge-preview\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.Controller.extend({\n      needs: ['modal'],\n\n      sample: Em.computed.alias('model.sample'),\n      errors: Em.computed.alias('model.errors'),\n      count: Em.computed.alias('model.grant_count'),\n\n      count_warning: function() {\n        if (this.get('count') \u003c= 10) {\n          return this.get('sample.length') !== this.get('count');\n        } else {\n          return this.get('sample.length') !== 10;\n        }\n      }.property('count', 'sample.length'),\n\n      has_query_plan: function() {\n        return !!this.get('model.query_plan');\n      }.property('model.query_plan'),\n\n      query_plan_html: function() {\n        var raw = this.get('model.query_plan'),\n            returned = \"\u003cpre class='badge-query-plan'\u003e\";\n\n        _.each(raw, function(linehash) {\n          returned += Handlebars.Utils.escapeExpression(linehash[\"QUERY PLAN\"]);\n          returned += \"\u003cbr\u003e\";\n        });\n\n        returned += \"\u003c/pre\u003e\";\n        return returned;\n      }.property('model.query_plan'),\n\n      processed_sample: Ember.computed.map('model.sample', function(grant) {\n        var i18nKey = 'admin.badges.preview.grant.with',\n            i18nParams = { username: Handlebars.Utils.escapeExpression(grant.username) };\n\n        if (grant.post_id) {\n          i18nKey += \"_post\";\n          i18nParams.link = \"\u003ca href='/p/\" + grant.post_id + \"' data-auto-route='true'\u003e\" + Handlebars.Utils.escapeExpression(grant.title) + \"\u003c/a\u003e\";\n        }\n\n        if (grant.granted_at) {\n          i18nKey += \"_time\";\n          i18nParams.time = Handlebars.Utils.escapeExpression(moment(grant.granted_at).format(I18n.t('dates.long_with_year')));\n        }\n\n        return I18n.t(i18nKey, i18nParams);\n      })\n    });\n  });";
define("admin/controllers/admin-badge", 
  ["discourse/controllers/object","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ObjectController = __dependency1__["default"];

    /**
      This is the itemController for `Discourse.AdminBadgesController`. Its main purpose
      is to indicate which badge was selected.

      @class AdminBadgeController
      @extends ObjectController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = ObjectController.extend({
      /**
        Whether this badge has been selected.

        @property selected
        @type {Boolean}
      **/
      selected: Discourse.computed.propertyEqual('model.name', 'parentController.selectedItem.name'),

      /**
        Show the displayName only if it is different from the name.

        @property showDisplayName
        @type {Boolean}
      **/
      showDisplayName: Discourse.computed.propertyNotEqual('selectedItem.name', 'selectedItem.displayName'),

      /**
        Don't allow editing if this is a system badge.

        @property readOnly
        @type {Boolean}
      **/
      readOnly: Ember.computed.alias('model.system')
    });
  });

Discourse.AdminBadgeController = require('admin/controllers/admin-badge').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-badge.js'] = "define(\"admin/controllers/admin-badge\", \n  [\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var ObjectController = __dependency1__[\"default\"];\n\n    /**\n      This is the itemController for `Discourse.AdminBadgesController`. Its main purpose\n      is to indicate which badge was selected.\n\n      @class AdminBadgeController\n      @extends ObjectController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = ObjectController.extend({\n      /**\n        Whether this badge has been selected.\n\n        @property selected\n        @type {Boolean}\n      **/\n      selected: Discourse.computed.propertyEqual('model.name', 'parentController.selectedItem.name'),\n\n      /**\n        Show the displayName only if it is different from the name.\n\n        @property showDisplayName\n        @type {Boolean}\n      **/\n      showDisplayName: Discourse.computed.propertyNotEqual('selectedItem.name', 'selectedItem.displayName'),\n\n      /**\n        Don't allow editing if this is a system badge.\n\n        @property readOnly\n        @type {Boolean}\n      **/\n      readOnly: Ember.computed.alias('model.system')\n    });\n  });";
define("admin/controllers/admin-badges", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for dealing with badges.

      @class AdminBadgesController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({
      needs: ['modal'],
      itemController: 'admin-badge',
      queryParams: ['badgeId'],
      badgeId: Em.computed.alias('selectedId'),

      /**
        ID of the currently selected badge.

        @property selectedId
        @type {Integer}
      **/
      selectedId: null,

      /**
        Badge that is currently selected.

        @property selectedItem
        @type {Discourse.Badge}
      **/
      selectedItem: function() {
        if (this.get('selectedId') === undefined || this.get('selectedId') === "undefined") {
          // New Badge
          return this.get('newBadge');
        } else {
          // Existing Badge
          var selectedId = parseInt(this.get('selectedId'));
          return this.get('model').filter(function(badge) {
            return parseInt(badge.get('id')) === selectedId;
          })[0];
        }
      }.property('selectedId', 'newBadge'),

      /**
        Unsaved badge, if one exists.

        @property newBadge
        @type {Discourse.Badge}
      **/
      newBadge: function() {
        return this.get('model').filter(function(badge) {
          return badge.get('id') === undefined;
        })[0];
      }.property('model.@each.id'),

      /**
        Whether a new unsaved badge exists.

        @property newBadgeExists
        @type {Discourse.Badge}
      **/
      newBadgeExists: Em.computed.notEmpty('newBadge'),

      /**
        We don't allow setting a description if a translation for the given badge
        name exists.

        @property canEditDescription
        @type {Boolean}
      **/
      canEditDescription: Em.computed.none('selectedItem.translatedDescription'),

      /**
        Disable saving if the currently selected item is being saved.

        @property disableSave
        @type {Boolean}
      **/
      disableSave: Em.computed.alias('selectedItem.saving'),

      actions: {

        /**
          Create a new badge and select it.

          @method newBadge
        **/
        createNewBadge: function() {
          var badge = Discourse.Badge.create({
            name: I18n.t('admin.badges.new_badge')
          });
          this.pushObject(badge);
          this.send('selectBadge', badge);
        },

        /**
          Select a particular badge.

          @method selectBadge
          @param {Discourse.Badge} badge The badge to be selected
        **/
        selectBadge: function(badge) {
          this.set('selectedId', badge.get('id'));
        },

        /**
          Save the selected badge.

          @method save
        **/
        save: function() {
          if (!this.get('disableSave')) {
            var fields = ['allow_title', 'multiple_grant',
                         'listable', 'auto_revoke',
                         'enabled', 'show_posts',
                         'target_posts', 'name', 'description',
                         'icon', 'query', 'badge_grouping_id',
                         'trigger', 'badge_type_id'],
                self = this;

            if (this.get('selectedItem.system')){
              var protectedFields = this.get('protectedSystemFields');
              fields = _.filter(fields, function(f){
                return !_.include(protectedFields,f);
              });
            }

            this.get('selectedItem').save(fields).catch(function(error) {
              // this shows the admin-badge-preview modal with the error
              // kinda weird, but it consolidates the display logic for badge errors
              self.send('saveError', error);
            });
          }
        },

        /**
          Confirm before destroying the selected badge.

          @method destroy
        **/
        destroy: function() {
          // Delete immediately if the selected badge is new.
          if (!this.get('selectedItem.id')) {
            this.get('model').removeObject(this.get('selectedItem'));
            this.set('selectedId', null);
            return;
          }

          var self = this;
          return bootbox.confirm(I18n.t("admin.badges.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              var selected = self.get('selectedItem');
              selected.destroy().then(function() {
                // Success.
                self.set('selectedId', null);
                self.get('model').removeObject(selected);
              }, function() {
                // Failure.
                bootbox.alert(I18n.t('generic_error'));
              });
            }
          });
        }

      }

    });
  });

Discourse.AdminBadgesController = require('admin/controllers/admin-badges').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-badges.js'] = "define(\"admin/controllers/admin-badges\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for dealing with badges.\n\n      @class AdminBadgesController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      needs: ['modal'],\n      itemController: 'admin-badge',\n      queryParams: ['badgeId'],\n      badgeId: Em.computed.alias('selectedId'),\n\n      /**\n        ID of the currently selected badge.\n\n        @property selectedId\n        @type {Integer}\n      **/\n      selectedId: null,\n\n      /**\n        Badge that is currently selected.\n\n        @property selectedItem\n        @type {Discourse.Badge}\n      **/\n      selectedItem: function() {\n        if (this.get('selectedId') === undefined || this.get('selectedId') === \"undefined\") {\n          // New Badge\n          return this.get('newBadge');\n        } else {\n          // Existing Badge\n          var selectedId = parseInt(this.get('selectedId'));\n          return this.get('model').filter(function(badge) {\n            return parseInt(badge.get('id')) === selectedId;\n          })[0];\n        }\n      }.property('selectedId', 'newBadge'),\n\n      /**\n        Unsaved badge, if one exists.\n\n        @property newBadge\n        @type {Discourse.Badge}\n      **/\n      newBadge: function() {\n        return this.get('model').filter(function(badge) {\n          return badge.get('id') === undefined;\n        })[0];\n      }.property('model.@each.id'),\n\n      /**\n        Whether a new unsaved badge exists.\n\n        @property newBadgeExists\n        @type {Discourse.Badge}\n      **/\n      newBadgeExists: Em.computed.notEmpty('newBadge'),\n\n      /**\n        We don't allow setting a description if a translation for the given badge\n        name exists.\n\n        @property canEditDescription\n        @type {Boolean}\n      **/\n      canEditDescription: Em.computed.none('selectedItem.translatedDescription'),\n\n      /**\n        Disable saving if the currently selected item is being saved.\n\n        @property disableSave\n        @type {Boolean}\n      **/\n      disableSave: Em.computed.alias('selectedItem.saving'),\n\n      actions: {\n\n        /**\n          Create a new badge and select it.\n\n          @method newBadge\n        **/\n        createNewBadge: function() {\n          var badge = Discourse.Badge.create({\n            name: I18n.t('admin.badges.new_badge')\n          });\n          this.pushObject(badge);\n          this.send('selectBadge', badge);\n        },\n\n        /**\n          Select a particular badge.\n\n          @method selectBadge\n          @param {Discourse.Badge} badge The badge to be selected\n        **/\n        selectBadge: function(badge) {\n          this.set('selectedId', badge.get('id'));\n        },\n\n        /**\n          Save the selected badge.\n\n          @method save\n        **/\n        save: function() {\n          if (!this.get('disableSave')) {\n            var fields = ['allow_title', 'multiple_grant',\n                         'listable', 'auto_revoke',\n                         'enabled', 'show_posts',\n                         'target_posts', 'name', 'description',\n                         'icon', 'query', 'badge_grouping_id',\n                         'trigger', 'badge_type_id'],\n                self = this;\n\n            if (this.get('selectedItem.system')){\n              var protectedFields = this.get('protectedSystemFields');\n              fields = _.filter(fields, function(f){\n                return !_.include(protectedFields,f);\n              });\n            }\n\n            this.get('selectedItem').save(fields).catch(function(error) {\n              // this shows the admin-badge-preview modal with the error\n              // kinda weird, but it consolidates the display logic for badge errors\n              self.send('saveError', error);\n            });\n          }\n        },\n\n        /**\n          Confirm before destroying the selected badge.\n\n          @method destroy\n        **/\n        destroy: function() {\n          // Delete immediately if the selected badge is new.\n          if (!this.get('selectedItem.id')) {\n            this.get('model').removeObject(this.get('selectedItem'));\n            this.set('selectedId', null);\n            return;\n          }\n\n          var self = this;\n          return bootbox.confirm(I18n.t(\"admin.badges.delete_confirm\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              var selected = self.get('selectedItem');\n              selected.destroy().then(function() {\n                // Success.\n                self.set('selectedId', null);\n                self.get('model').removeObject(selected);\n              }, function() {\n                // Failure.\n                bootbox.alert(I18n.t('generic_error'));\n              });\n            }\n          });\n        }\n\n      }\n\n    });\n  });";
define("admin/controllers/admin-commits", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ArrayController.extend({
      actions: {
        goToGithub: function() {
          window.open('https://github.com/discourse/discourse');
        }
      }
    });
  });

Discourse.AdminCommitsController = require('admin/controllers/admin-commits').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-commits.js'] = "define(\"admin/controllers/admin-commits\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      actions: {\n        goToGithub: function() {\n          window.open('https://github.com/discourse/discourse');\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-customize-colors", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports interface for creating custom CSS skins in Discourse.

      @class AdminCustomizeColorsController
      @extends Ember.Controller
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({

      onlyOverridden: false,

      baseColorScheme: function() {
        return this.get('model').findBy('is_base', true);
      }.property('model.@each.id'),

      baseColors: function() {
        var baseColorsHash = Em.Object.create({});
        _.each(this.get('baseColorScheme.colors'), function(color){
          baseColorsHash.set(color.get('name'), color);
        });
        return baseColorsHash;
      }.property('baseColorScheme'),

      removeSelected: function() {
        this.removeObject(this.get('selectedItem'));
        this.set('selectedItem', null);
      },

      filterContent: function() {
        if (!this.get('selectedItem')) { return; }

        if (!this.get('onlyOverridden')) {
          this.set('colors', this.get('selectedItem.colors'));
          return;
        }

        var matches = Em.A();

        _.each(this.get('selectedItem.colors'), function(color){
          if (color.get('overridden')) matches.pushObject(color);
        });

        this.set('colors', matches);
      }.observes('onlyOverridden'),

      updateEnabled: function() {
        var selectedItem = this.get('selectedItem');
        if (selectedItem.get('enabled')) {
          this.get('model').forEach(function(c) {
            if (c !== selectedItem) {
              c.set('enabled', false);
              c.startTrackingChanges();
              c.notifyPropertyChange('description');
            }
          });
        }
      },

      actions: {
        selectColorScheme: function(colorScheme) {
          if (this.get('selectedItem')) { this.get('selectedItem').set('selected', false); }
          this.set('selectedItem', colorScheme);
          this.set('colors', colorScheme.get('colors'));
          colorScheme.set('savingStatus', null);
          colorScheme.set('selected', true);
          this.filterContent();
        },

        newColorScheme: function() {
          var newColorScheme = Em.copy(this.get('baseColorScheme'), true);
          newColorScheme.set('name', I18n.t('admin.customize.colors.new_name'));
          this.pushObject(newColorScheme);
          this.send('selectColorScheme', newColorScheme);
          this.set('onlyOverridden', false);
        },

        revert: function(color) {
          color.revert();
        },

        undo: function(color) {
          color.undo();
        },

        toggleEnabled: function() {
          var selectedItem = this.get('selectedItem');
          selectedItem.toggleProperty('enabled');
          selectedItem.save({enabledOnly: true});
          this.updateEnabled();
        },

        save: function() {
          this.get('selectedItem').save();
          this.updateEnabled();
        },

        copy: function(colorScheme) {
          var newColorScheme = Em.copy(colorScheme, true);
          newColorScheme.set('name', I18n.t('admin.customize.colors.copy_name_prefix') + ' ' + colorScheme.get('name'));
          this.pushObject(newColorScheme);
          this.send('selectColorScheme', newColorScheme);
        },

        destroy: function() {
          var self = this,
              item = self.get('selectedItem');

          return bootbox.confirm(I18n.t("admin.customize.colors.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              if (item.get('newRecord')) {
                self.removeSelected();
              } else {
                item.destroy().then(function(){ self.removeSelected(); });
              }
            }
          });
        }
      }

    });
  });

Discourse.AdminCustomizeColorsController = require('admin/controllers/admin-customize-colors').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-customize-colors.js'] = "define(\"admin/controllers/admin-customize-colors\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports interface for creating custom CSS skins in Discourse.\n\n      @class AdminCustomizeColorsController\n      @extends Ember.Controller\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n\n      onlyOverridden: false,\n\n      baseColorScheme: function() {\n        return this.get('model').findBy('is_base', true);\n      }.property('model.@each.id'),\n\n      baseColors: function() {\n        var baseColorsHash = Em.Object.create({});\n        _.each(this.get('baseColorScheme.colors'), function(color){\n          baseColorsHash.set(color.get('name'), color);\n        });\n        return baseColorsHash;\n      }.property('baseColorScheme'),\n\n      removeSelected: function() {\n        this.removeObject(this.get('selectedItem'));\n        this.set('selectedItem', null);\n      },\n\n      filterContent: function() {\n        if (!this.get('selectedItem')) { return; }\n\n        if (!this.get('onlyOverridden')) {\n          this.set('colors', this.get('selectedItem.colors'));\n          return;\n        }\n\n        var matches = Em.A();\n\n        _.each(this.get('selectedItem.colors'), function(color){\n          if (color.get('overridden')) matches.pushObject(color);\n        });\n\n        this.set('colors', matches);\n      }.observes('onlyOverridden'),\n\n      updateEnabled: function() {\n        var selectedItem = this.get('selectedItem');\n        if (selectedItem.get('enabled')) {\n          this.get('model').forEach(function(c) {\n            if (c !== selectedItem) {\n              c.set('enabled', false);\n              c.startTrackingChanges();\n              c.notifyPropertyChange('description');\n            }\n          });\n        }\n      },\n\n      actions: {\n        selectColorScheme: function(colorScheme) {\n          if (this.get('selectedItem')) { this.get('selectedItem').set('selected', false); }\n          this.set('selectedItem', colorScheme);\n          this.set('colors', colorScheme.get('colors'));\n          colorScheme.set('savingStatus', null);\n          colorScheme.set('selected', true);\n          this.filterContent();\n        },\n\n        newColorScheme: function() {\n          var newColorScheme = Em.copy(this.get('baseColorScheme'), true);\n          newColorScheme.set('name', I18n.t('admin.customize.colors.new_name'));\n          this.pushObject(newColorScheme);\n          this.send('selectColorScheme', newColorScheme);\n          this.set('onlyOverridden', false);\n        },\n\n        revert: function(color) {\n          color.revert();\n        },\n\n        undo: function(color) {\n          color.undo();\n        },\n\n        toggleEnabled: function() {\n          var selectedItem = this.get('selectedItem');\n          selectedItem.toggleProperty('enabled');\n          selectedItem.save({enabledOnly: true});\n          this.updateEnabled();\n        },\n\n        save: function() {\n          this.get('selectedItem').save();\n          this.updateEnabled();\n        },\n\n        copy: function(colorScheme) {\n          var newColorScheme = Em.copy(colorScheme, true);\n          newColorScheme.set('name', I18n.t('admin.customize.colors.copy_name_prefix') + ' ' + colorScheme.get('name'));\n          this.pushObject(newColorScheme);\n          this.send('selectColorScheme', newColorScheme);\n        },\n\n        destroy: function() {\n          var self = this,\n              item = self.get('selectedItem');\n\n          return bootbox.confirm(I18n.t(\"admin.customize.colors.delete_confirm\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              if (item.get('newRecord')) {\n                self.removeSelected();\n              } else {\n                item.destroy().then(function(){ self.removeSelected(); });\n              }\n            }\n          });\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-customize-css-html", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports interface for creating custom CSS skins in Discourse.

      @class AdminCustomizeCssHtmlController
      @extends Ember.Controller
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({

      actions: {

        /**
          Create a new customization style

          @method newCustomization
        **/
        newCustomization: function() {
          var item = Discourse.SiteCustomization.create({name: I18n.t("admin.customize.new_style")});
          this.pushObject(item);
          this.set('selectedItem', item);
        },

        /**
          Select a given style

          @method selectStyle
          @param {Discourse.SiteCustomization} style The style we are selecting
        **/
        selectStyle: function(style) {
          this.set('selectedItem', style);
        },

        /**
          Save the current customization

          @method save
        **/
        save: function() {
          this.get('selectedItem').save();
        },

        /**
          Destroy the current customization

          @method destroy
        **/
        destroy: function() {
          var _this = this;
          return bootbox.confirm(I18n.t("admin.customize.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            var selected;
            if (result) {
              selected = _this.get('selectedItem');
              selected.destroy();
              _this.set('selectedItem', null);
              return _this.removeObject(selected);
            }
          });
        }

      }

    });
  });

Discourse.AdminCustomizeCssHtmlController = require('admin/controllers/admin-customize-css-html').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-customize-css-html.js'] = "define(\"admin/controllers/admin-customize-css-html\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports interface for creating custom CSS skins in Discourse.\n\n      @class AdminCustomizeCssHtmlController\n      @extends Ember.Controller\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n\n      actions: {\n\n        /**\n          Create a new customization style\n\n          @method newCustomization\n        **/\n        newCustomization: function() {\n          var item = Discourse.SiteCustomization.create({name: I18n.t(\"admin.customize.new_style\")});\n          this.pushObject(item);\n          this.set('selectedItem', item);\n        },\n\n        /**\n          Select a given style\n\n          @method selectStyle\n          @param {Discourse.SiteCustomization} style The style we are selecting\n        **/\n        selectStyle: function(style) {\n          this.set('selectedItem', style);\n        },\n\n        /**\n          Save the current customization\n\n          @method save\n        **/\n        save: function() {\n          this.get('selectedItem').save();\n        },\n\n        /**\n          Destroy the current customization\n\n          @method destroy\n        **/\n        destroy: function() {\n          var _this = this;\n          return bootbox.confirm(I18n.t(\"admin.customize.delete_confirm\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            var selected;\n            if (result) {\n              selected = _this.get('selectedItem');\n              selected.destroy();\n              _this.set('selectedItem', null);\n              return _this.removeObject(selected);\n            }\n          });\n        }\n\n      }\n\n    });\n  });";
define("admin/controllers/admin-dashboard", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the default interface when you enter the admin section.

      @class AdminDashboardController
      @extends Ember.Controller
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.Controller.extend({
      loading: true,
      versionCheck: null,
      problemsCheckMinutes: 1,

      foundProblems: function() {
        return(Discourse.User.currentProp('admin') && this.get('problems') && this.get('problems').length > 0);
      }.property('problems'),

      thereWereProblems: function() {
        if(!Discourse.User.currentProp('admin')) { return false }
        if( this.get('foundProblems') ) {
          this.set('hadProblems', true);
          return true;
        } else {
          return this.get('hadProblems') || false;
        }
      }.property('foundProblems'),

      loadProblems: function() {
        this.set('loadingProblems', true);
        this.set('problemsFetchedAt', new Date());
        var c = this;
        Discourse.AdminDashboard.fetchProblems().then(function(d) {
          c.set('problems', d.problems);
          c.set('loadingProblems', false);
          if( d.problems && d.problems.length > 0 ) {
            c.problemsCheckInterval = 1;
          } else {
            c.problemsCheckInterval = 10;
          }
        });
      },

      problemsTimestamp: function() {
        return moment(this.get('problemsFetchedAt')).format('LLL');
      }.property('problemsFetchedAt'),

      updatedTimestamp: function() {
        return moment(this.get('updated_at')).format('LLL');
      }.property('updated_at'),

      actions: {
        refreshProblems: function() {
          this.loadProblems();
        }
      }

    });
  });

Discourse.AdminDashboardController = require('admin/controllers/admin-dashboard').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-dashboard.js'] = "define(\"admin/controllers/admin-dashboard\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the default interface when you enter the admin section.\n\n      @class AdminDashboardController\n      @extends Ember.Controller\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.Controller.extend({\n      loading: true,\n      versionCheck: null,\n      problemsCheckMinutes: 1,\n\n      foundProblems: function() {\n        return(Discourse.User.currentProp('admin') \u0026\u0026 this.get('problems') \u0026\u0026 this.get('problems').length \u003e 0);\n      }.property('problems'),\n\n      thereWereProblems: function() {\n        if(!Discourse.User.currentProp('admin')) { return false }\n        if( this.get('foundProblems') ) {\n          this.set('hadProblems', true);\n          return true;\n        } else {\n          return this.get('hadProblems') || false;\n        }\n      }.property('foundProblems'),\n\n      loadProblems: function() {\n        this.set('loadingProblems', true);\n        this.set('problemsFetchedAt', new Date());\n        var c = this;\n        Discourse.AdminDashboard.fetchProblems().then(function(d) {\n          c.set('problems', d.problems);\n          c.set('loadingProblems', false);\n          if( d.problems \u0026\u0026 d.problems.length \u003e 0 ) {\n            c.problemsCheckInterval = 1;\n          } else {\n            c.problemsCheckInterval = 10;\n          }\n        });\n      },\n\n      problemsTimestamp: function() {\n        return moment(this.get('problemsFetchedAt')).format('LLL');\n      }.property('problemsFetchedAt'),\n\n      updatedTimestamp: function() {\n        return moment(this.get('updated_at')).format('LLL');\n      }.property('updated_at'),\n\n      actions: {\n        refreshProblems: function() {\n          this.loadProblems();\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-delete-flag", 
  ["discourse/mixins/modal-functionality","discourse/controllers/object","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];

    var ObjectController = __dependency2__["default"];

    __exports__["default"] = ObjectController.extend(ModalFunctionality, {

      needs: ["adminFlags"],

      actions: {

        deletePostDeferFlag: function () {
          var adminFlagController = this.get("controllers.adminFlags");
          var post = this.get("content");
          var self = this;

          return post.deferFlags(true).then(function () {
            adminFlagController.removeObject(post);
            self.send("closeModal");
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        },

        deletePostAgreeFlag: function () {
          var adminFlagController = this.get("controllers.adminFlags");
          var post = this.get("content");
          var self = this;

          return post.agreeFlags("delete").then(function () {
            adminFlagController.removeObject(post);
            self.send("closeModal");
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        }

      }

    });
  });

Discourse.AdminDeleteFlagController = require('admin/controllers/admin-delete-flag').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-delete-flag.js'] = "define(\"admin/controllers/admin-delete-flag\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n\n    var ObjectController = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = ObjectController.extend(ModalFunctionality, {\n\n      needs: [\"adminFlags\"],\n\n      actions: {\n\n        deletePostDeferFlag: function () {\n          var adminFlagController = this.get(\"controllers.adminFlags\");\n          var post = this.get(\"content\");\n          var self = this;\n\n          return post.deferFlags(true).then(function () {\n            adminFlagController.removeObject(post);\n            self.send(\"closeModal\");\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        },\n\n        deletePostAgreeFlag: function () {\n          var adminFlagController = this.get(\"controllers.adminFlags\");\n          var post = this.get(\"content\");\n          var self = this;\n\n          return post.agreeFlags(\"delete\").then(function () {\n            adminFlagController.removeObject(post);\n            self.send(\"closeModal\");\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        }\n\n      }\n\n    });\n  });";
define("admin/controllers/admin-edit-badge-groupings", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Controller.extend({
      needs: ['modal'],

      modelChanged: function(){

        var grouping = Em.Object.extend({});

        var model = this.get('model');
        var copy = Em.A();

        if(model){
          model.forEach(function(o){
            copy.pushObject(grouping.create(o));
          });
        }

        this.set('workingCopy', copy);
      }.observes('model'),

      moveItem: function(item, delta){
        var copy = this.get('workingCopy');
        var index = copy.indexOf(item);
        if (index + delta < 0 || index + delta >= copy.length){
          return;
        }

        copy.removeAt(index);
        copy.insertAt(index+delta, item);
      },

      actions: {
        up: function(item){
          this.moveItem(item, -1);
        },
        down: function(item){
          this.moveItem(item, 1);
        },
        "delete": function(item){
          this.get('workingCopy').removeObject(item);
        },
        cancel: function(){
          this.set('model', null);
          this.set('workingCopy', null);
          this.send('closeModal');
        },
        edit: function(item){
          item.set("editing", true);
        },
        save: function(item){
          item.set("editing", false);
        },
        add: function(){
          var obj = Em.Object.create({editing: true, name: "Enter Name"});
          this.get('workingCopy').pushObject(obj);
        },
        saveAll: function(){
          var self = this;
          var items = this.get('workingCopy');
          var groupIds = items.map(function(i){return i.get("id") || -1});
          var names = items.map(function(i){return i.get("name")});

          Discourse.ajax('/admin/badges/badge_groupings',{
            data: {ids: groupIds, names: names},
            method: 'POST'
          }).then(function(data){
            items = self.get("model");
            items.clear();
            data.badge_groupings.forEach(function(g){
              items.pushObject(Em.Object.create(g));
            });
            self.set('model', null);
            self.set('workingCopy', null);
            self.send('closeModal');
          },function(){
            // TODO we can do better
            bootbox.alert("Something went wrong");
          });
        }
      }
    });
  });

Discourse.AdminEditBadgeGroupingsController = require('admin/controllers/admin-edit-badge-groupings').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-edit-badge-groupings.js'] = "define(\"admin/controllers/admin-edit-badge-groupings\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.Controller.extend({\n      needs: ['modal'],\n\n      modelChanged: function(){\n\n        var grouping = Em.Object.extend({});\n\n        var model = this.get('model');\n        var copy = Em.A();\n\n        if(model){\n          model.forEach(function(o){\n            copy.pushObject(grouping.create(o));\n          });\n        }\n\n        this.set('workingCopy', copy);\n      }.observes('model'),\n\n      moveItem: function(item, delta){\n        var copy = this.get('workingCopy');\n        var index = copy.indexOf(item);\n        if (index + delta \u003c 0 || index + delta \u003e= copy.length){\n          return;\n        }\n\n        copy.removeAt(index);\n        copy.insertAt(index+delta, item);\n      },\n\n      actions: {\n        up: function(item){\n          this.moveItem(item, -1);\n        },\n        down: function(item){\n          this.moveItem(item, 1);\n        },\n        \"delete\": function(item){\n          this.get('workingCopy').removeObject(item);\n        },\n        cancel: function(){\n          this.set('model', null);\n          this.set('workingCopy', null);\n          this.send('closeModal');\n        },\n        edit: function(item){\n          item.set(\"editing\", true);\n        },\n        save: function(item){\n          item.set(\"editing\", false);\n        },\n        add: function(){\n          var obj = Em.Object.create({editing: true, name: \"Enter Name\"});\n          this.get('workingCopy').pushObject(obj);\n        },\n        saveAll: function(){\n          var self = this;\n          var items = this.get('workingCopy');\n          var groupIds = items.map(function(i){return i.get(\"id\") || -1});\n          var names = items.map(function(i){return i.get(\"name\")});\n\n          Discourse.ajax('/admin/badges/badge_groupings',{\n            data: {ids: groupIds, names: names},\n            method: 'POST'\n          }).then(function(data){\n            items = self.get(\"model\");\n            items.clear();\n            data.badge_groupings.forEach(function(g){\n              items.pushObject(Em.Object.create(g));\n            });\n            self.set('model', null);\n            self.set('workingCopy', null);\n            self.send('closeModal');\n          },function(){\n            // TODO we can do better\n            bootbox.alert(\"Something went wrong\");\n          });\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-email-all", 
  ["admin/controllers/admin-email-skipped","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var AdminEmailSkippedController = __dependency1__["default"];

    __exports__["default"] = AdminEmailSkippedController.extend();
  });

Discourse.AdminEmailAllController = require('admin/controllers/admin-email-all').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-email-all.js'] = "define(\"admin/controllers/admin-email-all\", \n  [\"admin/controllers/admin-email-skipped\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var AdminEmailSkippedController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = AdminEmailSkippedController.extend();\n  });";
define("admin/controllers/admin-email-index", 
  ["discourse/controllers/controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DiscourseController = __dependency1__["default"];

    __exports__["default"] = DiscourseController.extend({

      /**
        Is the "send test email" button disabled?

        @property sendTestEmailDisabled
      **/
      sendTestEmailDisabled: Em.computed.empty('testEmailAddress'),

      /**
        Clears the 'sentTestEmail' property on successful send.

        @method testEmailAddressChanged
      **/
      testEmailAddressChanged: function() {
        this.set('sentTestEmail', false);
      }.observes('testEmailAddress'),

      actions: {
        /**
          Sends a test email to the currently entered email address

          @method sendTestEmail
        **/
        sendTestEmail: function() {
          this.setProperties({
            sendingEmail: true,
            sentTestEmail: false
          });

          var self = this;
          Discourse.ajax("/admin/email/test", {
            type: 'POST',
            data: { email_address: this.get('testEmailAddress') }
          }).then(function () {
            self.set('sentTestEmail', true);
          }).catch(function () {
            bootbox.alert(I18n.t('admin.email.test_error'));
          }).finally(function() {
            self.set('sendingEmail', false);
          });

        }
      }

    });
  });

Discourse.AdminEmailIndexController = require('admin/controllers/admin-email-index').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-email-index.js'] = "define(\"admin/controllers/admin-email-index\", \n  [\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var DiscourseController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = DiscourseController.extend({\n\n      /**\n        Is the \"send test email\" button disabled?\n\n        @property sendTestEmailDisabled\n      **/\n      sendTestEmailDisabled: Em.computed.empty('testEmailAddress'),\n\n      /**\n        Clears the 'sentTestEmail' property on successful send.\n\n        @method testEmailAddressChanged\n      **/\n      testEmailAddressChanged: function() {\n        this.set('sentTestEmail', false);\n      }.observes('testEmailAddress'),\n\n      actions: {\n        /**\n          Sends a test email to the currently entered email address\n\n          @method sendTestEmail\n        **/\n        sendTestEmail: function() {\n          this.setProperties({\n            sendingEmail: true,\n            sentTestEmail: false\n          });\n\n          var self = this;\n          Discourse.ajax(\"/admin/email/test\", {\n            type: 'POST',\n            data: { email_address: this.get('testEmailAddress') }\n          }).then(function () {\n            self.set('sentTestEmail', true);\n          }).catch(function () {\n            bootbox.alert(I18n.t('admin.email.test_error'));\n          }).finally(function() {\n            self.set('sendingEmail', false);\n          });\n\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-email-preview-digest", 
  ["discourse/controllers/object","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ObjectController = __dependency1__["default"];

    /**
      This controller previews an email digest

      @class AdminEmailPreviewDigestController
      @extends ObjectController
      @namespace Discourse
      @module Discourse
    **/
    __exports__["default"] = ObjectController.extend({

      actions: {
        refresh: function() {
          var model = this.get('model'),
              self = this;

          self.set('loading', true);
          Discourse.EmailPreview.findDigest(this.get('lastSeen')).then(function (email) {
            model.setProperties(email.getProperties('html_content', 'text_content'));
            self.set('loading', false);
          });
        },

        toggleShowHtml: function() {
          this.toggleProperty('showHtml');
        }
      }

    });
  });

Discourse.AdminEmailPreviewDigestController = require('admin/controllers/admin-email-preview-digest').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-email-preview-digest.js'] = "define(\"admin/controllers/admin-email-preview-digest\", \n  [\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var ObjectController = __dependency1__[\"default\"];\n\n    /**\n      This controller previews an email digest\n\n      @class AdminEmailPreviewDigestController\n      @extends ObjectController\n      @namespace Discourse\n      @module Discourse\n    **/\n    __exports__[\"default\"] = ObjectController.extend({\n\n      actions: {\n        refresh: function() {\n          var model = this.get('model'),\n              self = this;\n\n          self.set('loading', true);\n          Discourse.EmailPreview.findDigest(this.get('lastSeen')).then(function (email) {\n            model.setProperties(email.getProperties('html_content', 'text_content'));\n            self.set('loading', false);\n          });\n        },\n\n        toggleShowHtml: function() {\n          this.toggleProperty('showHtml');\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-email-sent", 
  ["discourse/controllers/controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DiscourseController = __dependency1__["default"];

    __exports__["default"] = DiscourseController.extend({

      filterEmailLogs: Discourse.debounce(function() {
        var self = this;
        Discourse.EmailLog.findAll(this.get("filter")).then(function(logs) {
          self.set("model", logs);
        });
      }, 250).observes("filter.user", "filter.address", "filter.type", "filter.reply_key")
    });
  });

Discourse.AdminEmailSentController = require('admin/controllers/admin-email-sent').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-email-sent.js'] = "define(\"admin/controllers/admin-email-sent\", \n  [\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var DiscourseController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = DiscourseController.extend({\n\n      filterEmailLogs: Discourse.debounce(function() {\n        var self = this;\n        Discourse.EmailLog.findAll(this.get(\"filter\")).then(function(logs) {\n          self.set(\"model\", logs);\n        });\n      }, 250).observes(\"filter.user\", \"filter.address\", \"filter.type\", \"filter.reply_key\")\n    });\n  });";
define("admin/controllers/admin-flags", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for dealing with flags in the admin section.

      @class AdminFlagsController
      @extends Ember.Controller
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({

      adminOldFlagsView: Em.computed.equal("query", "old"),
      adminActiveFlagsView: Em.computed.equal("query", "active"),

      actions: {

        disagreeFlags: function (flaggedPost) {
          var self = this;
          flaggedPost.disagreeFlags().then(function () {
            self.removeObject(flaggedPost);
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        },

        deferFlags: function (flaggedPost) {
          var self = this;
          flaggedPost.deferFlags().then(function () {
            self.removeObject(flaggedPost);
          }, function () {
            bootbox.alert(I18n.t("admin.flags.error"));
          });
        },

        doneTopicFlags: function(item) {
          this.send("disagreeFlags", item);
        },
      },

      loadMore: function(){
        var flags = this.get("model");
        return Discourse.FlaggedPost.findAll(this.get("query"),flags.length+1).then(function(data){
          if(data.length===0){
            flags.set("allLoaded",true);
          }
          flags.addObjects(data);
        });
      }

    });
  });

Discourse.AdminFlagsController = require('admin/controllers/admin-flags').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-flags.js'] = "define(\"admin/controllers/admin-flags\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for dealing with flags in the admin section.\n\n      @class AdminFlagsController\n      @extends Ember.Controller\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n\n      adminOldFlagsView: Em.computed.equal(\"query\", \"old\"),\n      adminActiveFlagsView: Em.computed.equal(\"query\", \"active\"),\n\n      actions: {\n\n        disagreeFlags: function (flaggedPost) {\n          var self = this;\n          flaggedPost.disagreeFlags().then(function () {\n            self.removeObject(flaggedPost);\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        },\n\n        deferFlags: function (flaggedPost) {\n          var self = this;\n          flaggedPost.deferFlags().then(function () {\n            self.removeObject(flaggedPost);\n          }, function () {\n            bootbox.alert(I18n.t(\"admin.flags.error\"));\n          });\n        },\n\n        doneTopicFlags: function(item) {\n          this.send(\"disagreeFlags\", item);\n        },\n      },\n\n      loadMore: function(){\n        var flags = this.get(\"model\");\n        return Discourse.FlaggedPost.findAll(this.get(\"query\"),flags.length+1).then(function(data){\n          if(data.length===0){\n            flags.set(\"allLoaded\",true);\n          }\n          flags.addObjects(data);\n        });\n      }\n\n    });\n  });";
define("admin/controllers/admin-group", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Em.ObjectController.extend({
      needs: ['adminGroups'],
      members: null,
      disableSave: false,

      aliasLevelOptions: function() {
        return [
          { name: I18n.t("groups.alias_levels.nobody"), value: 0},
          { name: I18n.t("groups.alias_levels.mods_and_admins"), value: 2},
          { name: I18n.t("groups.alias_levels.members_mods_and_admins"), value: 3},
          { name: I18n.t("groups.alias_levels.everyone"), value: 99}
        ];
      }.property(),

      usernames: function(key, value) {
        var members = this.get('members');
        if (arguments.length > 1) {
          this.set('_usernames', value);
        } else {
          var usernames;
          if(members) {
            usernames = members.map(function(user) {
              return user.get('username');
            }).join(',');
          }
          this.set('_usernames', usernames);
        }
        return this.get('_usernames');
      }.property('members.@each.username'),

      actions: {
        save: function() {
          var self = this,
              group = this.get('model');

          self.set('disableSave', true);

          var promise;
          if (group.get('id')) {
            promise = group.saveWithUsernames(this.get('usernames'));
          } else {
            promise = group.createWithUsernames(this.get('usernames')).then(function() {
              var groupsController = self.get('controllers.adminGroups');
              groupsController.addObject(group);
            });
          }
          promise.then(function() {
            self.send('showGroup', group);
          }, function(e) {
            var message = $.parseJSON(e.responseText).errors;
            bootbox.alert(message);
          }).finally(function() {
            self.set('disableSave', false);
          });
        },

        destroy: function() {
          var group = this.get('model'),
              groupsController = this.get('controllers.adminGroups'),
              self = this;

          bootbox.confirm(I18n.t("admin.groups.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              self.set('disableSave', true);
              group.destroy().then(function() {
                groupsController.get('model').removeObject(group);
                self.transitionToRoute('adminGroups.index');
              }, function() {
                bootbox.alert(I18n.t("admin.groups.delete_failed"));
              }).finally(function() {
                self.set('disableSave', false);
              });
            }
          });
        }
      }
    });
  });

Discourse.AdminGroupController = require('admin/controllers/admin-group').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-group.js'] = "define(\"admin/controllers/admin-group\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Em.ObjectController.extend({\n      needs: ['adminGroups'],\n      members: null,\n      disableSave: false,\n\n      aliasLevelOptions: function() {\n        return [\n          { name: I18n.t(\"groups.alias_levels.nobody\"), value: 0},\n          { name: I18n.t(\"groups.alias_levels.mods_and_admins\"), value: 2},\n          { name: I18n.t(\"groups.alias_levels.members_mods_and_admins\"), value: 3},\n          { name: I18n.t(\"groups.alias_levels.everyone\"), value: 99}\n        ];\n      }.property(),\n\n      usernames: function(key, value) {\n        var members = this.get('members');\n        if (arguments.length \u003e 1) {\n          this.set('_usernames', value);\n        } else {\n          var usernames;\n          if(members) {\n            usernames = members.map(function(user) {\n              return user.get('username');\n            }).join(',');\n          }\n          this.set('_usernames', usernames);\n        }\n        return this.get('_usernames');\n      }.property('members.@each.username'),\n\n      actions: {\n        save: function() {\n          var self = this,\n              group = this.get('model');\n\n          self.set('disableSave', true);\n\n          var promise;\n          if (group.get('id')) {\n            promise = group.saveWithUsernames(this.get('usernames'));\n          } else {\n            promise = group.createWithUsernames(this.get('usernames')).then(function() {\n              var groupsController = self.get('controllers.adminGroups');\n              groupsController.addObject(group);\n            });\n          }\n          promise.then(function() {\n            self.send('showGroup', group);\n          }, function(e) {\n            var message = $.parseJSON(e.responseText).errors;\n            bootbox.alert(message);\n          }).finally(function() {\n            self.set('disableSave', false);\n          });\n        },\n\n        destroy: function() {\n          var group = this.get('model'),\n              groupsController = this.get('controllers.adminGroups'),\n              self = this;\n\n          bootbox.confirm(I18n.t(\"admin.groups.delete_confirm\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              self.set('disableSave', true);\n              group.destroy().then(function() {\n                groupsController.get('model').removeObject(group);\n                self.transitionToRoute('adminGroups.index');\n              }, function() {\n                bootbox.alert(I18n.t(\"admin.groups.delete_failed\"));\n              }).finally(function() {\n                self.set('disableSave', false);\n              });\n            }\n          });\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-groups", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ArrayController.extend({
      sortProperties: ['name'],

      refreshingAutoGroups: false,

      actions: {
        refreshAutoGroups: function(){
          var self = this,
              groups = this.get('model');

          self.set('refreshingAutoGroups', true);
          this.transitionToRoute('adminGroups.index').then(function() {
            Discourse.ajax('/admin/groups/refresh_automatic_groups', {type: 'POST'}).then(function() {
              return Discourse.Group.findAll().then(function(newGroups) {
                groups.clear();
                groups.addObjects(newGroups);
              }).finally(function() {
                self.set('refreshingAutoGroups', false);
              });
            });
          });
        }
      }
    });
  });

Discourse.AdminGroupsController = require('admin/controllers/admin-groups').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-groups.js'] = "define(\"admin/controllers/admin-groups\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      sortProperties: ['name'],\n\n      refreshingAutoGroups: false,\n\n      actions: {\n        refreshAutoGroups: function(){\n          var self = this,\n              groups = this.get('model');\n\n          self.set('refreshingAutoGroups', true);\n          this.transitionToRoute('adminGroups.index').then(function() {\n            Discourse.ajax('/admin/groups/refresh_automatic_groups', {type: 'POST'}).then(function() {\n              return Discourse.Group.findAll().then(function(newGroups) {\n                groups.clear();\n                groups.addObjects(newGroups);\n              }).finally(function() {\n                self.set('refreshingAutoGroups', false);\n              });\n            });\n          });\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-log-screened-ip-address", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ObjectController.extend({
      editing: false,
      savedIpAddress: null,

      actions: {
        allow: function(record) {
          record.set('action_name', 'do_nothing');
          this.send('save', record);
        },

        block: function(record) {
          record.set('action_name', 'block');
          this.send('save', record);
        },

        edit: function() {
          if (!this.get('editing')) {
            this.savedIpAddress = this.get('ip_address');
          }
          this.set('editing', true);
        },

        cancel: function() {
          if (this.get('savedIpAddress') && this.get('editing')) {
            this.set('ip_address', this.get('savedIpAddress'));
          }
          this.set('editing', false);
        },

        save: function(record) {
          var self = this;
          var wasEditing = this.get('editing');
          this.set('editing', false);
          record.save().then(function(saved){
            if (saved.success) {
              self.set('savedIpAddress', null);
            } else {
              bootbox.alert(saved.errors);
              if (wasEditing) self.set('editing', true);
            }
          }, function(e){
            if (e.responseJSON && e.responseJSON.errors) {
              bootbox.alert(I18n.t("generic_error_with_reason", {error: e.responseJSON.errors.join('. ')}));
            } else {
              bootbox.alert(I18n.t("generic_error"));
            }
            if (wasEditing) self.set('editing', true);
          });
        },

        destroy: function(record) {
          var self = this;
          return bootbox.confirm(I18n.t("admin.logs.screened_ips.delete_confirm", {ip_address: record.get('ip_address')}), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              record.destroy().then(function(deleted) {
                if (deleted) {
                  self.get("parentController.content").removeObject(record);
                } else {
                  bootbox.alert(I18n.t("generic_error"));
                }
              }, function(e){
                bootbox.alert(I18n.t("generic_error_with_reason", {error: "http: " + e.status + " - " + e.body}));
              });
            }
          });
        }
      }
    });
  });

Discourse.AdminLogScreenedIpAddressController = require('admin/controllers/admin-log-screened-ip-address').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-log-screened-ip-address.js'] = "define(\"admin/controllers/admin-log-screened-ip-address\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ObjectController.extend({\n      editing: false,\n      savedIpAddress: null,\n\n      actions: {\n        allow: function(record) {\n          record.set('action_name', 'do_nothing');\n          this.send('save', record);\n        },\n\n        block: function(record) {\n          record.set('action_name', 'block');\n          this.send('save', record);\n        },\n\n        edit: function() {\n          if (!this.get('editing')) {\n            this.savedIpAddress = this.get('ip_address');\n          }\n          this.set('editing', true);\n        },\n\n        cancel: function() {\n          if (this.get('savedIpAddress') \u0026\u0026 this.get('editing')) {\n            this.set('ip_address', this.get('savedIpAddress'));\n          }\n          this.set('editing', false);\n        },\n\n        save: function(record) {\n          var self = this;\n          var wasEditing = this.get('editing');\n          this.set('editing', false);\n          record.save().then(function(saved){\n            if (saved.success) {\n              self.set('savedIpAddress', null);\n            } else {\n              bootbox.alert(saved.errors);\n              if (wasEditing) self.set('editing', true);\n            }\n          }, function(e){\n            if (e.responseJSON \u0026\u0026 e.responseJSON.errors) {\n              bootbox.alert(I18n.t(\"generic_error_with_reason\", {error: e.responseJSON.errors.join('. ')}));\n            } else {\n              bootbox.alert(I18n.t(\"generic_error\"));\n            }\n            if (wasEditing) self.set('editing', true);\n          });\n        },\n\n        destroy: function(record) {\n          var self = this;\n          return bootbox.confirm(I18n.t(\"admin.logs.screened_ips.delete_confirm\", {ip_address: record.get('ip_address')}), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              record.destroy().then(function(deleted) {\n                if (deleted) {\n                  self.get(\"parentController.content\").removeObject(record);\n                } else {\n                  bootbox.alert(I18n.t(\"generic_error\"));\n                }\n              }, function(e){\n                bootbox.alert(I18n.t(\"generic_error_with_reason\", {error: \"http: \" + e.status + \" - \" + e.body}));\n              });\n            }\n          });\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-logs-screened-emails", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for listing screened email addresses in the admin section.

      @class AdminLogsScreenedEmailsController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      loading: false,
      content: [],

      clearBlock: function(row){
        row.clearBlock().then(function(){
          // feeling lazy
          window.location.reload();
        });
      },

      show: function() {
        var self = this;
        this.set('loading', true);
        Discourse.ScreenedEmail.findAll().then(function(result) {
          self.set('content', result);
          self.set('loading', false);
        });
      }
    });
  });

Discourse.AdminLogsScreenedEmailsController = require('admin/controllers/admin-logs-screened-emails').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-logs-screened-emails.js'] = "define(\"admin/controllers/admin-logs-screened-emails\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for listing screened email addresses in the admin section.\n\n      @class AdminLogsScreenedEmailsController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      loading: false,\n      content: [],\n\n      clearBlock: function(row){\n        row.clearBlock().then(function(){\n          // feeling lazy\n          window.location.reload();\n        });\n      },\n\n      show: function() {\n        var self = this;\n        this.set('loading', true);\n        Discourse.ScreenedEmail.findAll().then(function(result) {\n          self.set('content', result);\n          self.set('loading', false);\n        });\n      }\n    });\n  });";
define("admin/controllers/admin-logs-screened-ip-addresses", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for listing screened IP addresses in the admin section.

      @class AdminLogsScreenedIpAddressesController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      loading: false,
      content: [],
      itemController: 'admin-log-screened-ip-address',

      show: function() {
        var self = this;
        this.set('loading', true);
        Discourse.ScreenedIpAddress.findAll().then(function(result) {
          self.set('content', result);
          self.set('loading', false);
        });
      },

      actions: {
        recordAdded: function(arg) {
          this.get("content").unshiftObject(arg);
        }
      }
    });
  });

Discourse.AdminLogsScreenedIpAddressController = require('admin/controllers/admin-logs-screened-ip-addresses').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-logs-screened-ip-addresses.js'] = "define(\"admin/controllers/admin-logs-screened-ip-addresses\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for listing screened IP addresses in the admin section.\n\n      @class AdminLogsScreenedIpAddressesController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      loading: false,\n      content: [],\n      itemController: 'admin-log-screened-ip-address',\n\n      show: function() {\n        var self = this;\n        this.set('loading', true);\n        Discourse.ScreenedIpAddress.findAll().then(function(result) {\n          self.set('content', result);\n          self.set('loading', false);\n        });\n      },\n\n      actions: {\n        recordAdded: function(arg) {\n          this.get(\"content\").unshiftObject(arg);\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-logs-screened-urls", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for listing screened URLs in the admin section.

      @class AdminLogsScreenedUrlsController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      loading: false,
      content: [],

      show: function() {
        var self = this;
        this.set('loading', true);
        Discourse.ScreenedUrl.findAll().then(function(result) {
          self.set('content', result);
          self.set('loading', false);
        });
      }
    });
  });

Discourse.AdminLogsScreenedUrlsController = require('admin/controllers/admin-logs-screened-urls').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-logs-screened-urls.js'] = "define(\"admin/controllers/admin-logs-screened-urls\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for listing screened URLs in the admin section.\n\n      @class AdminLogsScreenedUrlsController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      loading: false,\n      content: [],\n\n      show: function() {\n        var self = this;\n        this.set('loading', true);\n        Discourse.ScreenedUrl.findAll().then(function(result) {\n          self.set('content', result);\n          self.set('loading', false);\n        });\n      }\n    });\n  });";
define("admin/controllers/admin-logs-staff-action-logs", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for listing staff action logs in the admin section.

      @class AdminLogsStaffActionLogsController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      loading: false,
      filters: {},

      show: function() {
        var self = this;
        this.set('loading', true);
        Discourse.URL.set('queryParams', this.get('filters')); // TODO: doesn't work
        Discourse.StaffActionLog.findAll(this.get('filters')).then(function(result) {
          self.set('content', result);
          self.set('loading', false);
        });
      }.observes('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),

      filtersExists: function() {
        return (_.size(this.get('filters')) > 0);
      }.property('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),

      actionFilter: function() {
        if (this.get('filters.action_name')) {
          return I18n.t("admin.logs.staff_actions.actions." + this.get('filters.action_name'));
        } else {
          return null;
        }
      }.property('filters.action_name'),

      showInstructions: function() {
        return this.get('model.length') > 0;
      }.property('loading', 'model.length'),

      actions: {
        clearFilter: function(key) {
          delete this.get('filters')[key];
          this.notifyPropertyChange('filters');
        },

        clearAllFilters: function() {
          this.set('filters', {});
        },

        filterByAction: function(action) {
          this.set('filters.action_name', action);
        },

        filterByStaffUser: function(acting_user) {
          this.set('filters.acting_user', acting_user.username);
        },

        filterByTargetUser: function(target_user) {
          this.set('filters.target_user', target_user.username);
        },

        filterBySubject: function(subject) {
          this.set('filters.subject', subject);
        }
      }
    });
  });

Discourse.AdminLogsStaffActionLogsController = require('admin/controllers/admin-logs-staff-action-logs').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-logs-staff-action-logs.js'] = "define(\"admin/controllers/admin-logs-staff-action-logs\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for listing staff action logs in the admin section.\n\n      @class AdminLogsStaffActionLogsController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      loading: false,\n      filters: {},\n\n      show: function() {\n        var self = this;\n        this.set('loading', true);\n        Discourse.URL.set('queryParams', this.get('filters')); // TODO: doesn't work\n        Discourse.StaffActionLog.findAll(this.get('filters')).then(function(result) {\n          self.set('content', result);\n          self.set('loading', false);\n        });\n      }.observes('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),\n\n      filtersExists: function() {\n        return (_.size(this.get('filters')) \u003e 0);\n      }.property('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),\n\n      actionFilter: function() {\n        if (this.get('filters.action_name')) {\n          return I18n.t(\"admin.logs.staff_actions.actions.\" + this.get('filters.action_name'));\n        } else {\n          return null;\n        }\n      }.property('filters.action_name'),\n\n      showInstructions: function() {\n        return this.get('model.length') \u003e 0;\n      }.property('loading', 'model.length'),\n\n      actions: {\n        clearFilter: function(key) {\n          delete this.get('filters')[key];\n          this.notifyPropertyChange('filters');\n        },\n\n        clearAllFilters: function() {\n          this.set('filters', {});\n        },\n\n        filterByAction: function(action) {\n          this.set('filters.action_name', action);\n        },\n\n        filterByStaffUser: function(acting_user) {\n          this.set('filters.acting_user', acting_user.username);\n        },\n\n        filterByTargetUser: function(target_user) {\n          this.set('filters.target_user', target_user.username);\n        },\n\n        filterBySubject: function(subject) {\n          this.set('filters.subject', subject);\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-reports", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ObjectController.extend({
      viewMode: 'table',
      viewingTable: Em.computed.equal('viewMode', 'table'),
      viewingBarChart: Em.computed.equal('viewMode', 'barChart'),

      actions: {
        // Changes the current view mode to 'table'
        viewAsTable: function() {
          this.set('viewMode', 'table');
        },

        // Changes the current view mode to 'barChart'
        viewAsBarChart: function() {
          this.set('viewMode', 'barChart');
        }
      }

    });
  });

Discourse.AdminReportsController = require('admin/controllers/admin-reports').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-reports.js'] = "define(\"admin/controllers/admin-reports\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ObjectController.extend({\n      viewMode: 'table',\n      viewingTable: Em.computed.equal('viewMode', 'table'),\n      viewingBarChart: Em.computed.equal('viewMode', 'barChart'),\n\n      actions: {\n        // Changes the current view mode to 'table'\n        viewAsTable: function() {\n          this.set('viewMode', 'table');\n        },\n\n        // Changes the current view mode to 'barChart'\n        viewAsBarChart: function() {\n          this.set('viewMode', 'barChart');\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-site-content-edit", 
  ["discourse/controllers/controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DiscourseController = __dependency1__["default"];

    __exports__["default"] = DiscourseController.extend({

      saveDisabled: function() {
        if (this.get('saving')) { return true; }
        if ((!this.get('content.allow_blank')) && this.blank('content.content')) { return true; }
        return false;
      }.property('saving', 'content.content'),

      actions: {
        saveChanges: function() {
          var self = this;
          self.setProperties({saving: true, saved: false});
          self.get('content').save().then(function () {
            self.setProperties({saving: false, saved: true});
          });
        }
      }
    });
  });

Discourse.AdminSiteContentEditController = require('admin/controllers/admin-site-content-edit').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-site-content-edit.js'] = "define(\"admin/controllers/admin-site-content-edit\", \n  [\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var DiscourseController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = DiscourseController.extend({\n\n      saveDisabled: function() {\n        if (this.get('saving')) { return true; }\n        if ((!this.get('content.allow_blank')) \u0026\u0026 this.blank('content.content')) { return true; }\n        return false;\n      }.property('saving', 'content.content'),\n\n      actions: {\n        saveChanges: function() {\n          var self = this;\n          self.setProperties({saving: true, saved: false});\n          self.get('content').save().then(function () {\n            self.setProperties({saving: false, saved: true});\n          });\n        }\n      }\n    });\n  });";
define("admin/controllers/admin-site-contents", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ArrayController.extend();
  });

Discourse.AdminSiteContentsController = require('admin/controllers/admin-site-contents').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-site-contents.js'] = "define(\"admin/controllers/admin-site-contents\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ArrayController.extend();\n  });";
define("admin/controllers/admin-site-settings-category", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.ObjectController.extend({
      categoryNameKey: null,
      needs: ['adminSiteSettings'],

      filteredContent: function() {
        if (!this.get('categoryNameKey')) { return Em.A(); }

        var category = this.get('controllers.adminSiteSettings.content').find(function(siteSettingCategory) {
          return siteSettingCategory.nameKey === this.get('categoryNameKey');
        }, this);

        if (category) {
          return category.siteSettings;
        } else {
          return Em.A();
        }
      }.property('controllers.adminSiteSettings.content', 'categoryNameKey'),

      emptyContentHandler: function() {
        if (this.get('filteredContent').length < 1) {
          if ( this.get('controllers.adminSiteSettings.filtered') ) {
            this.transitionToRoute('adminSiteSettingsCategory', 'all_results');
          } else {
            this.transitionToRoute('adminSiteSettings');
          }
        }
      }.observes('filteredContent'),

      actions: {

        /**
          Reset a setting to its default value

          @method resetDefault
          @param {Discourse.SiteSetting} setting The setting we want to revert
        **/
        resetDefault: function(setting) {
          setting.set('value', setting.get('default'));
          setting.save();
        },

        /**
          Save changes to a site setting

          @method save
          @param {Discourse.SiteSetting} setting The setting we've changed
        **/
        save: function(setting) {
          setting.save();
        },

        /**
          Cancel changes to a site setting

          @method cancel
          @param {Discourse.SiteSetting} setting The setting we've changed but want to revert
        **/
        cancel: function(setting) {
          setting.resetValue();
        }
      }

    });
  });

Discourse.AdminSiteSettingsCategoryController = require('admin/controllers/admin-site-settings-category').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-site-settings-category.js'] = "define(\"admin/controllers/admin-site-settings-category\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.ObjectController.extend({\n      categoryNameKey: null,\n      needs: ['adminSiteSettings'],\n\n      filteredContent: function() {\n        if (!this.get('categoryNameKey')) { return Em.A(); }\n\n        var category = this.get('controllers.adminSiteSettings.content').find(function(siteSettingCategory) {\n          return siteSettingCategory.nameKey === this.get('categoryNameKey');\n        }, this);\n\n        if (category) {\n          return category.siteSettings;\n        } else {\n          return Em.A();\n        }\n      }.property('controllers.adminSiteSettings.content', 'categoryNameKey'),\n\n      emptyContentHandler: function() {\n        if (this.get('filteredContent').length \u003c 1) {\n          if ( this.get('controllers.adminSiteSettings.filtered') ) {\n            this.transitionToRoute('adminSiteSettingsCategory', 'all_results');\n          } else {\n            this.transitionToRoute('adminSiteSettings');\n          }\n        }\n      }.observes('filteredContent'),\n\n      actions: {\n\n        /**\n          Reset a setting to its default value\n\n          @method resetDefault\n          @param {Discourse.SiteSetting} setting The setting we want to revert\n        **/\n        resetDefault: function(setting) {\n          setting.set('value', setting.get('default'));\n          setting.save();\n        },\n\n        /**\n          Save changes to a site setting\n\n          @method save\n          @param {Discourse.SiteSetting} setting The setting we've changed\n        **/\n        save: function(setting) {\n          setting.save();\n        },\n\n        /**\n          Cancel changes to a site setting\n\n          @method cancel\n          @param {Discourse.SiteSetting} setting The setting we've changed but want to revert\n        **/\n        cancel: function(setting) {\n          setting.resetValue();\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-site-settings", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for SiteSettings.

      @class AdminSiteSettingsController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      filter: null,
      onlyOverridden: false,
      filtered: Ember.computed.notEmpty('filter'),

      /**
        The list of settings based on the current filters

        @property filterContent
      **/
      filterContent: Discourse.debounce(function() {

        // If we have no content, don't bother filtering anything
        if (!this.present('allSiteSettings')) return;

        var filter;
        if (this.get('filter')) {
          filter = this.get('filter').toLowerCase();
        }

        if ((filter === undefined || filter.length < 1) && !this.get('onlyOverridden')) {
          this.set('model', this.get('allSiteSettings'));
          return;
        }

        var self = this,
            matches,
            matchesGroupedByCategory = Em.A([{nameKey: 'all_results', name: I18n.t('admin.site_settings.categories.all_results'), siteSettings: []}]);

        _.each(this.get('allSiteSettings'), function(settingsCategory) {
          matches = settingsCategory.siteSettings.filter(function(item) {
            if (self.get('onlyOverridden') && !item.get('overridden')) return false;
            if (filter) {
              if (item.get('setting').toLowerCase().indexOf(filter) > -1) return true;
              if (item.get('setting').toLowerCase().replace(/_/g, ' ').indexOf(filter) > -1) return true;
              if (item.get('description').toLowerCase().indexOf(filter) > -1) return true;
              if (item.get('value').toLowerCase().indexOf(filter) > -1) return true;
              return false;
            } else {
              return true;
            }
          });
          if (matches.length > 0) {
            matchesGroupedByCategory[0].siteSettings.pushObjects(matches);
            matchesGroupedByCategory.pushObject({
              nameKey: settingsCategory.nameKey,
              name: settingsCategory.name,
              siteSettings: matches});
          }
        });

        this.set('model', matchesGroupedByCategory);
      }, 250).observes('filter', 'onlyOverridden'),

      actions: {
        clearFilter: function() {
          this.set('filter', '');
          this.set('onlyOverridden', false);
        }
      }

    });
  });

Discourse.AdminSiteSettingsController = require('admin/controllers/admin-site-settings').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-site-settings.js'] = "define(\"admin/controllers/admin-site-settings\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for SiteSettings.\n\n      @class AdminSiteSettingsController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      filter: null,\n      onlyOverridden: false,\n      filtered: Ember.computed.notEmpty('filter'),\n\n      /**\n        The list of settings based on the current filters\n\n        @property filterContent\n      **/\n      filterContent: Discourse.debounce(function() {\n\n        // If we have no content, don't bother filtering anything\n        if (!this.present('allSiteSettings')) return;\n\n        var filter;\n        if (this.get('filter')) {\n          filter = this.get('filter').toLowerCase();\n        }\n\n        if ((filter === undefined || filter.length \u003c 1) \u0026\u0026 !this.get('onlyOverridden')) {\n          this.set('model', this.get('allSiteSettings'));\n          return;\n        }\n\n        var self = this,\n            matches,\n            matchesGroupedByCategory = Em.A([{nameKey: 'all_results', name: I18n.t('admin.site_settings.categories.all_results'), siteSettings: []}]);\n\n        _.each(this.get('allSiteSettings'), function(settingsCategory) {\n          matches = settingsCategory.siteSettings.filter(function(item) {\n            if (self.get('onlyOverridden') \u0026\u0026 !item.get('overridden')) return false;\n            if (filter) {\n              if (item.get('setting').toLowerCase().indexOf(filter) \u003e -1) return true;\n              if (item.get('setting').toLowerCase().replace(/_/g, ' ').indexOf(filter) \u003e -1) return true;\n              if (item.get('description').toLowerCase().indexOf(filter) \u003e -1) return true;\n              if (item.get('value').toLowerCase().indexOf(filter) \u003e -1) return true;\n              return false;\n            } else {\n              return true;\n            }\n          });\n          if (matches.length \u003e 0) {\n            matchesGroupedByCategory[0].siteSettings.pushObjects(matches);\n            matchesGroupedByCategory.pushObject({\n              nameKey: settingsCategory.nameKey,\n              name: settingsCategory.name,\n              siteSettings: matches});\n          }\n        });\n\n        this.set('model', matchesGroupedByCategory);\n      }, 250).observes('filter', 'onlyOverridden'),\n\n      actions: {\n        clearFilter: function() {\n          this.set('filter', '');\n          this.set('onlyOverridden', false);\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-staff-action-log-details", 
  ["discourse/mixins/modal-functionality","discourse/controllers/object","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];

    var ObjectController = __dependency2__["default"];

    __exports__["default"] = ObjectController.extend(ModalFunctionality);
  });

Discourse.AdminStaffActionLogDetailsController = require('admin/controllers/admin-staff-action-log-details').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-staff-action-log-details.js'] = "define(\"admin/controllers/admin-staff-action-log-details\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n\n    var ObjectController = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = ObjectController.extend(ModalFunctionality);\n  });";
define("admin/controllers/admin-start-backup", 
  ["discourse/mixins/modal-functionality","discourse/controllers/controller","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];
    var Controller = __dependency2__["default"];

    __exports__["default"] = Controller.extend(ModalFunctionality, {

      needs: ["adminBackupsLogs"],

      _startBackup: function (withUploads) {
        var self = this;
        Discourse.User.currentProp("hideReadOnlyAlert", true);
        Discourse.Backup.start(withUploads).then(function() {
          self.get("controllers.adminBackupsLogs").clear();
          self.send("backupStarted");
        });
      },

      actions: {

        startBackup: function () {
          return this._startBackup();
        },

        startBackupWithoutUpload: function () {
          return this._startBackup(false);
        },

        cancel: function () {
          this.send("closeModal");
        }

      }

    });
  });

Discourse.AdminStartBackupController = require('admin/controllers/admin-start-backup').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-start-backup.js'] = "define(\"admin/controllers/admin-start-backup\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n    var Controller = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = Controller.extend(ModalFunctionality, {\n\n      needs: [\"adminBackupsLogs\"],\n\n      _startBackup: function (withUploads) {\n        var self = this;\n        Discourse.User.currentProp(\"hideReadOnlyAlert\", true);\n        Discourse.Backup.start(withUploads).then(function() {\n          self.get(\"controllers.adminBackupsLogs\").clear();\n          self.send(\"backupStarted\");\n        });\n      },\n\n      actions: {\n\n        startBackup: function () {\n          return this._startBackup();\n        },\n\n        startBackupWithoutUpload: function () {\n          return this._startBackup(false);\n        },\n\n        cancel: function () {\n          this.send(\"closeModal\");\n        }\n\n      }\n\n    });\n  });";
define("admin/controllers/admin-suspend-user", 
  ["discourse/mixins/modal-functionality","discourse/controllers/object","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalFunctionality = __dependency1__["default"];

    var ObjectController = __dependency2__["default"];

    __exports__["default"] = ObjectController.extend(ModalFunctionality, {

      submitDisabled: function() {
        return (!this.get('reason') || this.get('reason').length < 1);
      }.property('reason'),

      actions: {
        suspend: function() {
          if (this.get('submitDisabled')) return;
          var duration = parseInt(this.get('duration'), 10);
          if (duration > 0) {
            var self = this;
            this.send('hideModal');
            this.get('model').suspend(duration, this.get('reason')).then(function() {
              window.location.reload();
            }, function(e) {
              var error = I18n.t('admin.user.suspend_failed', { error: "http: " + e.status + " - " + e.body });
              bootbox.alert(error, function() { self.send('showModal'); });
            });
          }
        }
      }

    });
  });

Discourse.AdminSuspendUserController = require('admin/controllers/admin-suspend-user').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-suspend-user.js'] = "define(\"admin/controllers/admin-suspend-user\", \n  [\"discourse/mixins/modal-functionality\",\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __dependency2__, __exports__) {\n    \"use strict\";\n    var ModalFunctionality = __dependency1__[\"default\"];\n\n    var ObjectController = __dependency2__[\"default\"];\n\n    __exports__[\"default\"] = ObjectController.extend(ModalFunctionality, {\n\n      submitDisabled: function() {\n        return (!this.get('reason') || this.get('reason').length \u003c 1);\n      }.property('reason'),\n\n      actions: {\n        suspend: function() {\n          if (this.get('submitDisabled')) return;\n          var duration = parseInt(this.get('duration'), 10);\n          if (duration \u003e 0) {\n            var self = this;\n            this.send('hideModal');\n            this.get('model').suspend(duration, this.get('reason')).then(function() {\n              window.location.reload();\n            }, function(e) {\n              var error = I18n.t('admin.user.suspend_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n              bootbox.alert(error, function() { self.send('showModal'); });\n            });\n          }\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-user-badges", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for granting and revoking badges from
      individual users.

      @class AdminUserBadgesController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend({
      needs: ["adminUser"],
      user: Em.computed.alias('controllers.adminUser'),
      sortProperties: ['granted_at'],
      sortAscending: false,

      /**
        Array of badges that have not been granted to this user.

        @property grantableBadges
        @type {Boolean}
      **/
      grantableBadges: function() {
        var granted = {};
        this.get('model').forEach(function(userBadge) {
          granted[userBadge.get('badge_id')] = true;
        });

        var badges = [];
        this.get('badges').forEach(function(badge) {
          if (badge.get('multiple_grant') || !granted[badge.get('id')]) {
            badges.push(badge);
          }
        });

        return badges;
      }.property('badges.@each', 'model.@each'),

      /**
        Whether there are any badges that can be granted.

        @property noBadges
        @type {Boolean}
      **/
      noBadges: Em.computed.empty('grantableBadges'),

      actions: {

        /**
          Grant the selected badge to the user.

          @method grantBadge
          @param {Integer} badgeId id of the badge we want to grant.
        **/
        grantBadge: function(badgeId) {
          var self = this;
          Discourse.UserBadge.grant(badgeId, this.get('user.username')).then(function(userBadge) {
            self.pushObject(userBadge);
            Ember.run.next(function() {
              // Update the selected badge ID after the combobox has re-rendered.
              var newSelectedBadge = self.get('grantableBadges')[0];
              if (newSelectedBadge) {
                self.set('selectedBadgeId', newSelectedBadge.get('id'));
              }
            });
          }, function() {
            // Failure
            bootbox.alert(I18n.t('generic_error'));
          });
        },

        /**
          Revoke the selected userBadge.

          @method revokeBadge
          @param {Discourse.UserBadge} userBadge the `Discourse.UserBadge` instance that needs to be revoked.
        **/
        revokeBadge: function(userBadge) {
          var self = this;
          return bootbox.confirm(I18n.t("admin.badges.revoke_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              userBadge.revoke().then(function() {
                self.get('model').removeObject(userBadge);
              });
            }
          });
        }

      }
    });
  });

Discourse.AdminUserBadgesController = require('admin/controllers/admin-user-badges').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-user-badges.js'] = "define(\"admin/controllers/admin-user-badges\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for granting and revoking badges from\n      individual users.\n\n      @class AdminUserBadgesController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend({\n      needs: [\"adminUser\"],\n      user: Em.computed.alias('controllers.adminUser'),\n      sortProperties: ['granted_at'],\n      sortAscending: false,\n\n      /**\n        Array of badges that have not been granted to this user.\n\n        @property grantableBadges\n        @type {Boolean}\n      **/\n      grantableBadges: function() {\n        var granted = {};\n        this.get('model').forEach(function(userBadge) {\n          granted[userBadge.get('badge_id')] = true;\n        });\n\n        var badges = [];\n        this.get('badges').forEach(function(badge) {\n          if (badge.get('multiple_grant') || !granted[badge.get('id')]) {\n            badges.push(badge);\n          }\n        });\n\n        return badges;\n      }.property('badges.@each', 'model.@each'),\n\n      /**\n        Whether there are any badges that can be granted.\n\n        @property noBadges\n        @type {Boolean}\n      **/\n      noBadges: Em.computed.empty('grantableBadges'),\n\n      actions: {\n\n        /**\n          Grant the selected badge to the user.\n\n          @method grantBadge\n          @param {Integer} badgeId id of the badge we want to grant.\n        **/\n        grantBadge: function(badgeId) {\n          var self = this;\n          Discourse.UserBadge.grant(badgeId, this.get('user.username')).then(function(userBadge) {\n            self.pushObject(userBadge);\n            Ember.run.next(function() {\n              // Update the selected badge ID after the combobox has re-rendered.\n              var newSelectedBadge = self.get('grantableBadges')[0];\n              if (newSelectedBadge) {\n                self.set('selectedBadgeId', newSelectedBadge.get('id'));\n              }\n            });\n          }, function() {\n            // Failure\n            bootbox.alert(I18n.t('generic_error'));\n          });\n        },\n\n        /**\n          Revoke the selected userBadge.\n\n          @method revokeBadge\n          @param {Discourse.UserBadge} userBadge the `Discourse.UserBadge` instance that needs to be revoked.\n        **/\n        revokeBadge: function(userBadge) {\n          var self = this;\n          return bootbox.confirm(I18n.t(\"admin.badges.revoke_confirm\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              userBadge.revoke().then(function() {\n                self.get('model').removeObject(userBadge);\n              });\n            }\n          });\n        }\n\n      }\n    });\n  });";
define("admin/controllers/admin-user-index", 
  ["discourse/controllers/object","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ObjectController = __dependency1__["default"];

    /**
      A controller related to viewing a user in the admin section

      @class AdminUserIndexController
      @extends ObjectController
      @namespace Discourse
      @module Discourse
    **/
    __exports__["default"] = ObjectController.extend({
      editingTitle: false,
      originalPrimaryGroupId: null,
      availableGroups: null,

      showApproval: Discourse.computed.setting('must_approve_users'),
      showBadges: Discourse.computed.setting('enable_badges'),

      primaryGroupDirty: Discourse.computed.propertyNotEqual('originalPrimaryGroupId', 'primary_group_id'),

      custom_groups: Ember.computed.filter("model.groups", function(g){
        return (!g.automatic && g.visible);
      }),

      actions: {
        toggleTitleEdit: function() {
          this.toggleProperty('editingTitle');
        },

        saveTitle: function() {
          Discourse.ajax("/users/" + this.get('username').toLowerCase(), {
            data: {title: this.get('title')},
            type: 'PUT'
          }).then(null, function(e){
            bootbox.alert(I18n.t("generic_error_with_reason", {error: "http: " + e.status + " - " + e.body}));
          });

          this.send('toggleTitleEdit');
        },

        generateApiKey: function() {
          this.get('model').generateApiKey();
        },

        groupAdded: function(added){
          this.get('model').groupAdded(added).catch(function() {
            bootbox.alert(I18n.t('generic_error'));
          });
        },

        groupRemoved: function(removed){
          this.get('model').groupRemoved(removed).catch(function() {
            bootbox.alert(I18n.t('generic_error'));
          });
        },

        savePrimaryGroup: function() {
          var self = this;
          Discourse.ajax("/admin/users/" + this.get('id') + "/primary_group", {
            type: 'PUT',
            data: {primary_group_id: this.get('primary_group_id')}
          }).then(function () {
            self.set('originalPrimaryGroupId', self.get('primary_group_id'));
          }).catch(function() {
            bootbox.alert(I18n.t('generic_error'));
          });
        },

        resetPrimaryGroup: function() {
          this.set('primary_group_id', this.get('originalPrimaryGroupId'));
        },

        regenerateApiKey: function() {
          var self = this;
          bootbox.confirm(I18n.t("admin.api.confirm_regen"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              self.get('model').generateApiKey();
            }
          });
        },

        revokeApiKey: function() {
          var self = this;
          bootbox.confirm(I18n.t("admin.api.confirm_revoke"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
            if (result) {
              self.get('model').revokeApiKey();
            }
          });
        }
      }

    });
  });

Discourse.AdminUserIndexController = require('admin/controllers/admin-user-index').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-user-index.js'] = "define(\"admin/controllers/admin-user-index\", \n  [\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var ObjectController = __dependency1__[\"default\"];\n\n    /**\n      A controller related to viewing a user in the admin section\n\n      @class AdminUserIndexController\n      @extends ObjectController\n      @namespace Discourse\n      @module Discourse\n    **/\n    __exports__[\"default\"] = ObjectController.extend({\n      editingTitle: false,\n      originalPrimaryGroupId: null,\n      availableGroups: null,\n\n      showApproval: Discourse.computed.setting('must_approve_users'),\n      showBadges: Discourse.computed.setting('enable_badges'),\n\n      primaryGroupDirty: Discourse.computed.propertyNotEqual('originalPrimaryGroupId', 'primary_group_id'),\n\n      custom_groups: Ember.computed.filter(\"model.groups\", function(g){\n        return (!g.automatic \u0026\u0026 g.visible);\n      }),\n\n      actions: {\n        toggleTitleEdit: function() {\n          this.toggleProperty('editingTitle');\n        },\n\n        saveTitle: function() {\n          Discourse.ajax(\"/users/\" + this.get('username').toLowerCase(), {\n            data: {title: this.get('title')},\n            type: 'PUT'\n          }).then(null, function(e){\n            bootbox.alert(I18n.t(\"generic_error_with_reason\", {error: \"http: \" + e.status + \" - \" + e.body}));\n          });\n\n          this.send('toggleTitleEdit');\n        },\n\n        generateApiKey: function() {\n          this.get('model').generateApiKey();\n        },\n\n        groupAdded: function(added){\n          this.get('model').groupAdded(added).catch(function() {\n            bootbox.alert(I18n.t('generic_error'));\n          });\n        },\n\n        groupRemoved: function(removed){\n          this.get('model').groupRemoved(removed).catch(function() {\n            bootbox.alert(I18n.t('generic_error'));\n          });\n        },\n\n        savePrimaryGroup: function() {\n          var self = this;\n          Discourse.ajax(\"/admin/users/\" + this.get('id') + \"/primary_group\", {\n            type: 'PUT',\n            data: {primary_group_id: this.get('primary_group_id')}\n          }).then(function () {\n            self.set('originalPrimaryGroupId', self.get('primary_group_id'));\n          }).catch(function() {\n            bootbox.alert(I18n.t('generic_error'));\n          });\n        },\n\n        resetPrimaryGroup: function() {\n          this.set('primary_group_id', this.get('originalPrimaryGroupId'));\n        },\n\n        regenerateApiKey: function() {\n          var self = this;\n          bootbox.confirm(I18n.t(\"admin.api.confirm_regen\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              self.get('model').generateApiKey();\n            }\n          });\n        },\n\n        revokeApiKey: function() {\n          var self = this;\n          bootbox.confirm(I18n.t(\"admin.api.confirm_revoke\"), I18n.t(\"no_value\"), I18n.t(\"yes_value\"), function(result) {\n            if (result) {\n              self.get('model').revokeApiKey();\n            }\n          });\n        }\n      }\n\n    });\n  });";
define("admin/controllers/admin-user", 
  ["discourse/controllers/object","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ObjectController = __dependency1__["default"];

    /**
      The top-level controller for user pages in admin.
      Ember assertion says that this class needs to be defined even if it's empty.

      @class AdminUserController
      @extends ObjectController
      @namespace Discourse
      @module Discourse
    **/
    __exports__["default"] = ObjectController.extend();
  });

Discourse.AdminUserController = require('admin/controllers/admin-user').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-user.js'] = "define(\"admin/controllers/admin-user\", \n  [\"discourse/controllers/object\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var ObjectController = __dependency1__[\"default\"];\n\n    /**\n      The top-level controller for user pages in admin.\n      Ember assertion says that this class needs to be defined even if it's empty.\n\n      @class AdminUserController\n      @extends ObjectController\n      @namespace Discourse\n      @module Discourse\n    **/\n    __exports__[\"default\"] = ObjectController.extend();\n  });";
define("admin/controllers/admin-users-list", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      This controller supports the interface for listing users in the admin section.

      @class AdminUsersListController
      @extends Ember.ArrayController
      @namespace Discourse
      @module Discourse
    **/

    __exports__["default"] = Ember.ArrayController.extend(Discourse.Presence, {
      username: null,
      query: null,
      selectAll: false,
      content: null,
      loading: false,

      queryNew: Em.computed.equal('query', 'new'),
      queryPending: Em.computed.equal('query', 'pending'),
      queryHasApproval: Em.computed.or('queryNew', 'queryPending'),

      /**
        Triggered when the selectAll property is changed

        @event selectAll
      **/
      selectAllChanged: function() {
        var _this = this;
        _.each(this.get('content'),function(user) {
          user.set('selected', _this.get('selectAll'));
        });
      }.observes('selectAll'),

      /**
        Triggered when the username filter is changed

        @event filterUsers
      **/
      filterUsers: Discourse.debounce(function() {
        this.refreshUsers();
      }, 250).observes('username'),

      /**
        Triggered when the order of the users list is changed

        @event orderChanged
      **/
      orderChanged: function() {
        this.refreshUsers();
      }.observes('query'),

      /**
        The title of the user list, based on which query was performed.

        @property title
      **/
      title: function() {
        return I18n.t('admin.users.titles.' + this.get('query'));
      }.property('query'),

      /**
        Do we want to show the approval controls?

        @property showApproval
      **/
      showApproval: function() {
        return Discourse.SiteSettings.must_approve_users && this.get('queryHasApproval');
      }.property('queryPending'),

      /**
        How many users are currently selected

        @property selectedCount
      **/
      selectedCount: function() {
        if (this.blank('content')) return 0;
        return this.get('content').filterProperty('selected').length;
      }.property('content.@each.selected'),

      /**
        Do we have any selected users?

        @property hasSelection
      **/
      hasSelection: Em.computed.gt('selectedCount', 0),

      /**
        Refresh the current list of users.

        @method refreshUsers
      **/
      refreshUsers: function() {
        var adminUsersListController = this;
        adminUsersListController.set('loading', true);

        Discourse.AdminUser.findAll(this.get('query'), { filter: this.get('username') }).then(function (result) {
          adminUsersListController.set('content', result);
          adminUsersListController.set('loading', false);
        });
      },


      /**
        Show the list of users.

        @method show
      **/
      show: function(term) {
        if (this.get('query') === term) {
          this.refreshUsers();
          return;
        }
        this.set('query', term);
      },

      /**
        Approve all the currently selected users.

        @method approveUsers
      **/
      approveUsers: function() {
        Discourse.AdminUser.bulkApprove(this.get('content').filterProperty('selected'));
        this.refreshUsers();
      },

      /**
        Reject all the currently selected users.

        @method rejectUsers
      **/
      rejectUsers: function() {
        var controller = this;
        Discourse.AdminUser.bulkReject(this.get('content').filterProperty('selected')).then(function(result){
          var message = I18n.t("admin.users.reject_successful", {count: result.success});
          if (result.failed > 0) {
            message += ' ' + I18n.t("admin.users.reject_failures", {count: result.failed});
            message += ' ' + I18n.t("admin.user.delete_forbidden", {count: Discourse.SiteSettings.delete_user_max_post_age});
          }
          bootbox.alert(message);
          controller.refreshUsers();
        });
      }

    });
  });

Discourse.AdminUsersListController = require('admin/controllers/admin-users-list').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin-users-list.js'] = "define(\"admin/controllers/admin-users-list\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      This controller supports the interface for listing users in the admin section.\n\n      @class AdminUsersListController\n      @extends Ember.ArrayController\n      @namespace Discourse\n      @module Discourse\n    **/\n\n    __exports__[\"default\"] = Ember.ArrayController.extend(Discourse.Presence, {\n      username: null,\n      query: null,\n      selectAll: false,\n      content: null,\n      loading: false,\n\n      queryNew: Em.computed.equal('query', 'new'),\n      queryPending: Em.computed.equal('query', 'pending'),\n      queryHasApproval: Em.computed.or('queryNew', 'queryPending'),\n\n      /**\n        Triggered when the selectAll property is changed\n\n        @event selectAll\n      **/\n      selectAllChanged: function() {\n        var _this = this;\n        _.each(this.get('content'),function(user) {\n          user.set('selected', _this.get('selectAll'));\n        });\n      }.observes('selectAll'),\n\n      /**\n        Triggered when the username filter is changed\n\n        @event filterUsers\n      **/\n      filterUsers: Discourse.debounce(function() {\n        this.refreshUsers();\n      }, 250).observes('username'),\n\n      /**\n        Triggered when the order of the users list is changed\n\n        @event orderChanged\n      **/\n      orderChanged: function() {\n        this.refreshUsers();\n      }.observes('query'),\n\n      /**\n        The title of the user list, based on which query was performed.\n\n        @property title\n      **/\n      title: function() {\n        return I18n.t('admin.users.titles.' + this.get('query'));\n      }.property('query'),\n\n      /**\n        Do we want to show the approval controls?\n\n        @property showApproval\n      **/\n      showApproval: function() {\n        return Discourse.SiteSettings.must_approve_users \u0026\u0026 this.get('queryHasApproval');\n      }.property('queryPending'),\n\n      /**\n        How many users are currently selected\n\n        @property selectedCount\n      **/\n      selectedCount: function() {\n        if (this.blank('content')) return 0;\n        return this.get('content').filterProperty('selected').length;\n      }.property('content.@each.selected'),\n\n      /**\n        Do we have any selected users?\n\n        @property hasSelection\n      **/\n      hasSelection: Em.computed.gt('selectedCount', 0),\n\n      /**\n        Refresh the current list of users.\n\n        @method refreshUsers\n      **/\n      refreshUsers: function() {\n        var adminUsersListController = this;\n        adminUsersListController.set('loading', true);\n\n        Discourse.AdminUser.findAll(this.get('query'), { filter: this.get('username') }).then(function (result) {\n          adminUsersListController.set('content', result);\n          adminUsersListController.set('loading', false);\n        });\n      },\n\n\n      /**\n        Show the list of users.\n\n        @method show\n      **/\n      show: function(term) {\n        if (this.get('query') === term) {\n          this.refreshUsers();\n          return;\n        }\n        this.set('query', term);\n      },\n\n      /**\n        Approve all the currently selected users.\n\n        @method approveUsers\n      **/\n      approveUsers: function() {\n        Discourse.AdminUser.bulkApprove(this.get('content').filterProperty('selected'));\n        this.refreshUsers();\n      },\n\n      /**\n        Reject all the currently selected users.\n\n        @method rejectUsers\n      **/\n      rejectUsers: function() {\n        var controller = this;\n        Discourse.AdminUser.bulkReject(this.get('content').filterProperty('selected')).then(function(result){\n          var message = I18n.t(\"admin.users.reject_successful\", {count: result.success});\n          if (result.failed \u003e 0) {\n            message += ' ' + I18n.t(\"admin.users.reject_failures\", {count: result.failed});\n            message += ' ' + I18n.t(\"admin.user.delete_forbidden\", {count: Discourse.SiteSettings.delete_user_max_post_age});\n          }\n          bootbox.alert(message);\n          controller.refreshUsers();\n        });\n      }\n\n    });\n  });";
define("admin/controllers/admin", 
  ["discourse/controllers/controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DiscourseController = __dependency1__["default"];

    __exports__["default"] = DiscourseController.extend({
      showBadges: function() {
        return this.get('currentUser.admin') && Discourse.SiteSettings.enable_badges;
      }.property()
    });
  });

Discourse.AdminController = require('admin/controllers/admin').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/admin.js'] = "define(\"admin/controllers/admin\", \n  [\"discourse/controllers/controller\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var DiscourseController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = DiscourseController.extend({\n      showBadges: function() {\n        return this.get('currentUser.admin') \u0026\u0026 Discourse.SiteSettings.enable_badges;\n      }.property()\n    });\n  });";
define("admin/controllers/delete-site-customization-details", 
  ["admin/controllers/change-site-customization-details","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ChangeSiteCustomizationDetailsController = __dependency1__["default"];

    __exports__["default"] = ChangeSiteCustomizationDetailsController.extend({
      onShow: function() {
        this.selectPrevious();
      }
    });
  });

Discourse.DeleteSiteCustomizationDetailsController = require('admin/controllers/delete-site-customization-details').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/controllers/delete-site-customization-details.js'] = "define(\"admin/controllers/delete-site-customization-details\", \n  [\"admin/controllers/change-site-customization-details\",\"exports\"],\n  function(__dependency1__, __exports__) {\n    \"use strict\";\n    var ChangeSiteCustomizationDetailsController = __dependency1__[\"default\"];\n\n    __exports__[\"default\"] = ChangeSiteCustomizationDetailsController.extend({\n      onShow: function() {\n        this.selectPrevious();\n      }\n    });\n  });";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Return the count of users at the given trust level.

  @method valueAtTrustLevel
  @for Handlebars
**/

Handlebars.registerHelper('valueAtTrustLevel', function(property, trustLevel) {
  var data = Ember.Handlebars.get(this, property);
  if( data ) {
    var item = data.find( function(d) { return parseInt(d.x,10) === parseInt(trustLevel,10); } );
    if( item ) {
      return item.y;
    } else {
      return 0;
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/helpers/report_helpers.js'] = "/**\n  Return the count of users at the given trust level.\n\n  @method valueAtTrustLevel\n  @for Handlebars\n**/\n\nHandlebars.registerHelper('valueAtTrustLevel', function(property, trustLevel) {\n  var data = Ember.Handlebars.get(this, property);\n  if( data ) {\n    var item = data.find( function(d) { return parseInt(d.x,10) === parseInt(trustLevel,10); } );\n    if( item ) {\n      return item.y;\n    } else {\n      return 0;\n    }\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A model that stores all or some data that is displayed on the dashboard.

  @class AdminDashboard
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/


Discourse.AdminDashboard = Discourse.Model.extend({});

Discourse.AdminDashboard.reopenClass({

  /**
    Fetch all dashboard data. This can be an expensive request when the cached data
    has expired and the server must collect the data again.

    @method find
    @return {jqXHR} a jQuery Promise object
  **/
  find: function() {
    return Discourse.ajax("/admin/dashboard.json").then(function(json) {
      var model = Discourse.AdminDashboard.create(json);
      model.set('loaded', true);
      return model;
    });
  },

  /**
    Only fetch the list of problems that should be rendered on the dashboard.
    The model will only have its "problems" attribute set.

    @method fetchProblems
    @return {jqXHR} a jQuery Promise object
  **/
  fetchProblems: function() {
    return Discourse.ajax("/admin/dashboard/problems.json", {
      type: 'GET',
      dataType: 'json'
    }).then(function(json) {
      var model = Discourse.AdminDashboard.create(json);
      model.set('loaded', true);
      return model;
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/admin_dashboard.js'] = "/**\n  A model that stores all or some data that is displayed on the dashboard.\n\n  @class AdminDashboard\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\n\nDiscourse.AdminDashboard = Discourse.Model.extend({});\n\nDiscourse.AdminDashboard.reopenClass({\n\n  /**\n    Fetch all dashboard data. This can be an expensive request when the cached data\n    has expired and the server must collect the data again.\n\n    @method find\n    @return {jqXHR} a jQuery Promise object\n  **/\n  find: function() {\n    return Discourse.ajax(\"/admin/dashboard.json\").then(function(json) {\n      var model = Discourse.AdminDashboard.create(json);\n      model.set('loaded', true);\n      return model;\n    });\n  },\n\n  /**\n    Only fetch the list of problems that should be rendered on the dashboard.\n    The model will only have its \"problems\" attribute set.\n\n    @method fetchProblems\n    @return {jqXHR} a jQuery Promise object\n  **/\n  fetchProblems: function() {\n    return Discourse.ajax(\"/admin/dashboard/problems.json\", {\n      type: 'GET',\n      dataType: 'json'\n    }).then(function(json) {\n      var model = Discourse.AdminDashboard.create(json);\n      model.set('loaded', true);\n      return model;\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for dealing with users from the admin section.

  @class AdminUser
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUser = Discourse.User.extend({

  /**
    Generates an API key for the user. Will regenerate if they already have one.

    @method generateApiKey
    @returns {Promise} a promise that resolves to the newly generated API key
  **/
  generateApiKey: function() {
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/generate_api_key", {type: 'POST'}).then(function (result) {
      var apiKey = Discourse.ApiKey.create(result.api_key);
      self.set('api_key', apiKey);
      return apiKey;
    });
  },

  groupAdded: function(added){
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/groups", {
      type: 'POST',
      data: {group_id: added.id}
    }).then(function () {
      self.get('groups').pushObject(added);
    });
  },

  groupRemoved: function(removed){
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/groups/" + removed.id, {
      type: 'DELETE'
    }).then(function () {
      self.set('groups.[]', self.get('groups').rejectBy("id", removed.id));
    });
  },

  /**
    Revokes a user's current API key

    @method revokeApiKey
    @returns {Promise} a promise that resolves when the API key has been deleted
  **/
  revokeApiKey: function() {
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/revoke_api_key", {type: 'DELETE'}).then(function () {
      self.set('api_key', null);
    });
  },

  deleteAllPostsExplanation: function() {
    if (!this.get('can_delete_all_posts')) {
      if (this.get('post_count') > Discourse.SiteSettings.delete_all_posts_max) {
        return I18n.t('admin.user.cant_delete_all_too_many_posts', {count: Discourse.SiteSettings.delete_all_posts_max});
      } else {
        return I18n.t('admin.user.cant_delete_all_posts', {count: Discourse.SiteSettings.delete_user_max_post_age});
      }
    } else {
      return null;
    }
  }.property('can_delete_all_posts'),

  deleteAllPosts: function() {
    var user = this;
    var message = I18n.t('admin.user.delete_all_posts_confirm', {posts: user.get('post_count'), topics: user.get('topic_count')});
    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel-inline",
      "link":  true
    }, {
      "label": '<i class="fa fa-exclamation-triangle"></i> ' + I18n.t("admin.user.delete_all_posts"),
      "class": "btn btn-danger",
      "callback": function() {
        Discourse.ajax("/admin/users/" + (user.get('id')) + "/delete_all_posts", {type: 'PUT'}).then(function(){
          user.set('post_count', 0);
        });
      }
    }];
    bootbox.dialog(message, buttons, {"classes": "delete-all-posts"});
  },

  // Revoke the user's admin access
  revokeAdmin: function() {
    this.set('admin', false);
    this.set('can_grant_admin', true);
    this.set('can_revoke_admin', false);
    return Discourse.ajax("/admin/users/" + (this.get('id')) + "/revoke_admin", {type: 'PUT'});
  },

  grantAdmin: function() {
    this.set('admin', true);
    this.set('can_grant_admin', false);
    this.set('can_revoke_admin', true);
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/grant_admin", {type: 'PUT'});
  },

  // Revoke the user's moderation access
  revokeModeration: function() {
    this.set('moderator', false);
    this.set('can_grant_moderation', true);
    this.set('can_revoke_moderation', false);
    return Discourse.ajax("/admin/users/" + (this.get('id')) + "/revoke_moderation", {type: 'PUT'});
  },

  grantModeration: function() {
    this.set('moderator', true);
    this.set('can_grant_moderation', false);
    this.set('can_revoke_moderation', true);
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/grant_moderation", {type: 'PUT'});
  },

  refreshBrowsers: function() {
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/refresh_browsers", {type: 'POST'});
    bootbox.alert(I18n.t("admin.user.refresh_browsers_message"));
  },

  approve: function() {
    this.set('can_approve', false);
    this.set('approved', true);
    this.set('approved_by', Discourse.User.current());
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/approve", {type: 'PUT'});
  },

  username_lower: (function() {
    return this.get('username').toLowerCase();
  }).property('username'),

  setOriginalTrustLevel: function() {
    this.set('originalTrustLevel', this.get('trust_level'));
  },

  trustLevels: function() {
    return Discourse.Site.currentProp('trustLevels');
  }.property(),

  dirty: Discourse.computed.propertyNotEqual('originalTrustLevel', 'trustLevel.id'),

  saveTrustLevel: function() {
    Discourse.ajax("/admin/users/" + this.id + "/trust_level", {
      type: 'PUT',
      data: {level: this.get('trustLevel.id')}
    }).then(function () {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failure
      var error;
      if (e.responseJSON && e.responseJSON.errors) {
        error = e.responseJSON.errors[0];
      }
      error = error || I18n.t('admin.user.trust_level_change_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  restoreTrustLevel: function() {
    this.set('trustLevel.id', this.get('originalTrustLevel'));
  },

  isSuspended: Em.computed.equal('suspended', true),
  canSuspend: Em.computed.not('staff'),

  suspendDuration: function() {
    var suspended_at = moment(this.suspended_at);
    var suspended_till = moment(this.suspended_till);
    return suspended_at.format('L') + " - " + suspended_till.format('L');
  }.property('suspended_till', 'suspended_at'),

  suspend: function(duration, reason) {
    return Discourse.ajax("/admin/users/" + this.id + "/suspend", {
      type: 'PUT',
      data: {duration: duration, reason: reason}
    });
  },

  unsuspend: function() {
    Discourse.ajax("/admin/users/" + this.id + "/unsuspend", {
      type: 'PUT'
    }).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.unsuspend_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  log_out: function(){
    Discourse.ajax("/admin/users/" + this.id + "/log_out", {
      type: 'POST',
      data: { username_or_email: this.get('username') }
    }).then(
      function(){
        bootbox.alert(I18n.t("admin.user.logged_out"));
      }
      );
  },

  impersonate: function() {
    Discourse.ajax("/admin/impersonate", {
      type: 'POST',
      data: { username_or_email: this.get('username') }
    }).then(function() {
      // succeeded
      document.location = "/";
    }, function(e) {
      // failed
      if (e.status === 404) {
        bootbox.alert(I18n.t('admin.impersonate.not_found'));
      } else {
        bootbox.alert(I18n.t('admin.impersonate.invalid'));
      }
    });
  },

  activate: function() {
    Discourse.ajax('/admin/users/' + this.id + '/activate', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.activate_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  deactivate: function() {
    Discourse.ajax('/admin/users/' + this.id + '/deactivate', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.deactivate_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  unblock: function() {
    Discourse.ajax('/admin/users/' + this.id + '/unblock', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.unblock_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  block: function() {
    Discourse.ajax('/admin/users/' + this.id + '/block', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.block_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  sendActivationEmail: function() {
    Discourse.ajax('/users/' + this.get('username') + '/send_activation_email', {type: 'POST'}).then(function() {
      // succeeded
      bootbox.alert( I18n.t('admin.user.activation_email_sent') );
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.send_activation_email_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  deleteForbidden: function() {
    return (!this.get('can_be_deleted') || this.get('post_count') > 0);
  }.property('post_count'),

  deleteExplanation: function() {
    if (this.get('deleteForbidden')) {
      if (this.get('staff')) {
        return I18n.t('admin.user.delete_forbidden_because_staff');
      } else {
        return I18n.t('admin.user.delete_forbidden', {count: Discourse.SiteSettings.delete_user_max_post_age});
      }
    } else {
      return null;
    }
  }.property('deleteForbidden'),

  destroy: function() {
    var user = this;

    var performDestroy = function(block) {
      var formData = { context: window.location.pathname };
      if (block) {
        formData["block_email"] = true;
        formData["block_urls"] = true;
        formData["block_ip"] = true;
      }
      Discourse.ajax("/admin/users/" + user.get('id') + '.json', {
        type: 'DELETE',
        data: formData
      }).then(function(data) {
        if (data.deleted) {
          bootbox.alert(I18n.t("admin.user.deleted"), function() {
            document.location = "/admin/users/list/active";
          });
        } else {
          bootbox.alert(I18n.t("admin.user.delete_failed"));
          if (data.user) {
            user.setProperties(data.user);
          }
        }
      }, function() {
        Discourse.AdminUser.find( user.get('username') ).then(function(u){ user.setProperties(u); });
        bootbox.alert(I18n.t("admin.user.delete_failed"));
      });
    };

    var message = I18n.t("admin.user.delete_confirm");

    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel",
      "link":  true
    }, {
      "label": I18n.t('admin.user.delete_dont_block'),
      "class": "btn",
      "callback": function(){
        performDestroy(false);
      }
    }, {
      "label": '<i class="fa fa-exclamation-triangle"></i>' + I18n.t('admin.user.delete_and_block'),
      "class": "btn btn-danger",
      "callback": function(){
        performDestroy(true);
      }
    }];

    bootbox.dialog(message, buttons, {"classes": "delete-user-modal"});
  },

  deleteAsSpammer: function(successCallback) {
    var user = this;
    var message = I18n.t('flagging.delete_confirm', {posts: user.get('post_count'), topics: user.get('topic_count'), email: user.get('email'), ip_address: user.get('ip_address')});
    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel-inline",
      "link":  true
    }, {
      "label": '<i class="fa fa-exclamation-triangle"></i> ' + I18n.t("flagging.yes_delete_spammer"),
      "class": "btn btn-danger",
      "callback": function() {
        Discourse.ajax("/admin/users/" + user.get('id') + '.json', {
          type: 'DELETE',
          data: {delete_posts: true, block_email: true, block_urls: true, block_ip: true, context: window.location.pathname}
        }).then(function(data) {
          if (data.deleted) {
            bootbox.alert(I18n.t("admin.user.deleted"), function() {
              if (successCallback) successCallback();
            });
          } else {
            bootbox.alert(I18n.t("admin.user.delete_failed"));
          }
        }, function() {
          bootbox.alert(I18n.t("admin.user.delete_failed"));
        });
      }
    }];
    bootbox.dialog(message, buttons, {"classes": "flagging-delete-spammer"});
  },

  loadDetails: function() {
    var model = this;
    if (model.get('loadedDetails')) { return Ember.RSVP.resolve(model); }

    return Discourse.AdminUser.find(model.get('username_lower')).then(function (result) {
      model.setProperties(result);
      model.set('loadedDetails', true);
    });
  },

  leaderRequirements: function() {
    if (this.get('leader_requirements')) {
      return Discourse.LeaderRequirements.create(this.get('leader_requirements'));
    }
  }.property('leader_requirements'),

  suspendedBy: function() {
    if (this.get('suspended_by')) {
      return Discourse.AdminUser.create(this.get('suspended_by'));
    }
  }.property('suspended_by'),

  approvedBy: function() {
    if (this.get('approved_by')) {
      return Discourse.AdminUser.create(this.get('approved_by'));
    }
  }.property('approved_by')

});

Discourse.AdminUser.reopenClass({

  bulkApprove: function(users) {
    _.each(users, function(user) {
      user.set('approved', true);
      user.set('can_approve', false);
      return user.set('selected', false);
    });

    bootbox.alert(I18n.t("admin.user.approve_bulk_success"));

    return Discourse.ajax("/admin/users/approve-bulk", {
      type: 'PUT',
      data: {
        users: users.map(function(u) {
          return u.id;
        })
      }
    });
  },

  bulkReject: function(users) {
    _.each(users, function(user){
      user.set('can_approve', false);
      user.set('selected', false);
    });

    return Discourse.ajax("/admin/users/reject-bulk", {
      type: 'DELETE',
      data: {
        users: users.map(function(u) { return u.id; }),
        context: window.location.pathname
      }
    });
  },

  find: function(username) {
    return Discourse.ajax("/admin/users/" + username + ".json").then(function (result) {
      result.loadedDetails = true;
      return Discourse.AdminUser.create(result);
    });
  },

  findAll: function(query, filter) {
    return Discourse.ajax("/admin/users/list/" + query + ".json", {
      data: filter
    }).then(function(users) {
      return users.map(function(u) {
        return Discourse.AdminUser.create(u);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/admin_user.js'] = "/**\n  Our data model for dealing with users from the admin section.\n\n  @class AdminUser\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUser = Discourse.User.extend({\n\n  /**\n    Generates an API key for the user. Will regenerate if they already have one.\n\n    @method generateApiKey\n    @returns {Promise} a promise that resolves to the newly generated API key\n  **/\n  generateApiKey: function() {\n    var self = this;\n    return Discourse.ajax(\"/admin/users/\" + this.get('id') + \"/generate_api_key\", {type: 'POST'}).then(function (result) {\n      var apiKey = Discourse.ApiKey.create(result.api_key);\n      self.set('api_key', apiKey);\n      return apiKey;\n    });\n  },\n\n  groupAdded: function(added){\n    var self = this;\n    return Discourse.ajax(\"/admin/users/\" + this.get('id') + \"/groups\", {\n      type: 'POST',\n      data: {group_id: added.id}\n    }).then(function () {\n      self.get('groups').pushObject(added);\n    });\n  },\n\n  groupRemoved: function(removed){\n    var self = this;\n    return Discourse.ajax(\"/admin/users/\" + this.get('id') + \"/groups/\" + removed.id, {\n      type: 'DELETE'\n    }).then(function () {\n      self.set('groups.[]', self.get('groups').rejectBy(\"id\", removed.id));\n    });\n  },\n\n  /**\n    Revokes a user's current API key\n\n    @method revokeApiKey\n    @returns {Promise} a promise that resolves when the API key has been deleted\n  **/\n  revokeApiKey: function() {\n    var self = this;\n    return Discourse.ajax(\"/admin/users/\" + this.get('id') + \"/revoke_api_key\", {type: 'DELETE'}).then(function () {\n      self.set('api_key', null);\n    });\n  },\n\n  deleteAllPostsExplanation: function() {\n    if (!this.get('can_delete_all_posts')) {\n      if (this.get('post_count') \u003e Discourse.SiteSettings.delete_all_posts_max) {\n        return I18n.t('admin.user.cant_delete_all_too_many_posts', {count: Discourse.SiteSettings.delete_all_posts_max});\n      } else {\n        return I18n.t('admin.user.cant_delete_all_posts', {count: Discourse.SiteSettings.delete_user_max_post_age});\n      }\n    } else {\n      return null;\n    }\n  }.property('can_delete_all_posts'),\n\n  deleteAllPosts: function() {\n    var user = this;\n    var message = I18n.t('admin.user.delete_all_posts_confirm', {posts: user.get('post_count'), topics: user.get('topic_count')});\n    var buttons = [{\n      \"label\": I18n.t(\"composer.cancel\"),\n      \"class\": \"cancel-inline\",\n      \"link\":  true\n    }, {\n      \"label\": '\u003ci class=\"fa fa-exclamation-triangle\"\u003e\u003c/i\u003e ' + I18n.t(\"admin.user.delete_all_posts\"),\n      \"class\": \"btn btn-danger\",\n      \"callback\": function() {\n        Discourse.ajax(\"/admin/users/\" + (user.get('id')) + \"/delete_all_posts\", {type: 'PUT'}).then(function(){\n          user.set('post_count', 0);\n        });\n      }\n    }];\n    bootbox.dialog(message, buttons, {\"classes\": \"delete-all-posts\"});\n  },\n\n  // Revoke the user's admin access\n  revokeAdmin: function() {\n    this.set('admin', false);\n    this.set('can_grant_admin', true);\n    this.set('can_revoke_admin', false);\n    return Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/revoke_admin\", {type: 'PUT'});\n  },\n\n  grantAdmin: function() {\n    this.set('admin', true);\n    this.set('can_grant_admin', false);\n    this.set('can_revoke_admin', true);\n    Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/grant_admin\", {type: 'PUT'});\n  },\n\n  // Revoke the user's moderation access\n  revokeModeration: function() {\n    this.set('moderator', false);\n    this.set('can_grant_moderation', true);\n    this.set('can_revoke_moderation', false);\n    return Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/revoke_moderation\", {type: 'PUT'});\n  },\n\n  grantModeration: function() {\n    this.set('moderator', true);\n    this.set('can_grant_moderation', false);\n    this.set('can_revoke_moderation', true);\n    Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/grant_moderation\", {type: 'PUT'});\n  },\n\n  refreshBrowsers: function() {\n    Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/refresh_browsers\", {type: 'POST'});\n    bootbox.alert(I18n.t(\"admin.user.refresh_browsers_message\"));\n  },\n\n  approve: function() {\n    this.set('can_approve', false);\n    this.set('approved', true);\n    this.set('approved_by', Discourse.User.current());\n    Discourse.ajax(\"/admin/users/\" + (this.get('id')) + \"/approve\", {type: 'PUT'});\n  },\n\n  username_lower: (function() {\n    return this.get('username').toLowerCase();\n  }).property('username'),\n\n  setOriginalTrustLevel: function() {\n    this.set('originalTrustLevel', this.get('trust_level'));\n  },\n\n  trustLevels: function() {\n    return Discourse.Site.currentProp('trustLevels');\n  }.property(),\n\n  dirty: Discourse.computed.propertyNotEqual('originalTrustLevel', 'trustLevel.id'),\n\n  saveTrustLevel: function() {\n    Discourse.ajax(\"/admin/users/\" + this.id + \"/trust_level\", {\n      type: 'PUT',\n      data: {level: this.get('trustLevel.id')}\n    }).then(function () {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failure\n      var error;\n      if (e.responseJSON \u0026\u0026 e.responseJSON.errors) {\n        error = e.responseJSON.errors[0];\n      }\n      error = error || I18n.t('admin.user.trust_level_change_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  restoreTrustLevel: function() {\n    this.set('trustLevel.id', this.get('originalTrustLevel'));\n  },\n\n  isSuspended: Em.computed.equal('suspended', true),\n  canSuspend: Em.computed.not('staff'),\n\n  suspendDuration: function() {\n    var suspended_at = moment(this.suspended_at);\n    var suspended_till = moment(this.suspended_till);\n    return suspended_at.format('L') + \" - \" + suspended_till.format('L');\n  }.property('suspended_till', 'suspended_at'),\n\n  suspend: function(duration, reason) {\n    return Discourse.ajax(\"/admin/users/\" + this.id + \"/suspend\", {\n      type: 'PUT',\n      data: {duration: duration, reason: reason}\n    });\n  },\n\n  unsuspend: function() {\n    Discourse.ajax(\"/admin/users/\" + this.id + \"/unsuspend\", {\n      type: 'PUT'\n    }).then(function() {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.unsuspend_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  log_out: function(){\n    Discourse.ajax(\"/admin/users/\" + this.id + \"/log_out\", {\n      type: 'POST',\n      data: { username_or_email: this.get('username') }\n    }).then(\n      function(){\n        bootbox.alert(I18n.t(\"admin.user.logged_out\"));\n      }\n      );\n  },\n\n  impersonate: function() {\n    Discourse.ajax(\"/admin/impersonate\", {\n      type: 'POST',\n      data: { username_or_email: this.get('username') }\n    }).then(function() {\n      // succeeded\n      document.location = \"/\";\n    }, function(e) {\n      // failed\n      if (e.status === 404) {\n        bootbox.alert(I18n.t('admin.impersonate.not_found'));\n      } else {\n        bootbox.alert(I18n.t('admin.impersonate.invalid'));\n      }\n    });\n  },\n\n  activate: function() {\n    Discourse.ajax('/admin/users/' + this.id + '/activate', {type: 'PUT'}).then(function() {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.activate_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  deactivate: function() {\n    Discourse.ajax('/admin/users/' + this.id + '/deactivate', {type: 'PUT'}).then(function() {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.deactivate_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  unblock: function() {\n    Discourse.ajax('/admin/users/' + this.id + '/unblock', {type: 'PUT'}).then(function() {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.unblock_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  block: function() {\n    Discourse.ajax('/admin/users/' + this.id + '/block', {type: 'PUT'}).then(function() {\n      // succeeded\n      window.location.reload();\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.block_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  sendActivationEmail: function() {\n    Discourse.ajax('/users/' + this.get('username') + '/send_activation_email', {type: 'POST'}).then(function() {\n      // succeeded\n      bootbox.alert( I18n.t('admin.user.activation_email_sent') );\n    }, function(e) {\n      // failed\n      var error = I18n.t('admin.user.send_activation_email_failed', { error: \"http: \" + e.status + \" - \" + e.body });\n      bootbox.alert(error);\n    });\n  },\n\n  deleteForbidden: function() {\n    return (!this.get('can_be_deleted') || this.get('post_count') \u003e 0);\n  }.property('post_count'),\n\n  deleteExplanation: function() {\n    if (this.get('deleteForbidden')) {\n      if (this.get('staff')) {\n        return I18n.t('admin.user.delete_forbidden_because_staff');\n      } else {\n        return I18n.t('admin.user.delete_forbidden', {count: Discourse.SiteSettings.delete_user_max_post_age});\n      }\n    } else {\n      return null;\n    }\n  }.property('deleteForbidden'),\n\n  destroy: function() {\n    var user = this;\n\n    var performDestroy = function(block) {\n      var formData = { context: window.location.pathname };\n      if (block) {\n        formData[\"block_email\"] = true;\n        formData[\"block_urls\"] = true;\n        formData[\"block_ip\"] = true;\n      }\n      Discourse.ajax(\"/admin/users/\" + user.get('id') + '.json', {\n        type: 'DELETE',\n        data: formData\n      }).then(function(data) {\n        if (data.deleted) {\n          bootbox.alert(I18n.t(\"admin.user.deleted\"), function() {\n            document.location = \"/admin/users/list/active\";\n          });\n        } else {\n          bootbox.alert(I18n.t(\"admin.user.delete_failed\"));\n          if (data.user) {\n            user.setProperties(data.user);\n          }\n        }\n      }, function() {\n        Discourse.AdminUser.find( user.get('username') ).then(function(u){ user.setProperties(u); });\n        bootbox.alert(I18n.t(\"admin.user.delete_failed\"));\n      });\n    };\n\n    var message = I18n.t(\"admin.user.delete_confirm\");\n\n    var buttons = [{\n      \"label\": I18n.t(\"composer.cancel\"),\n      \"class\": \"cancel\",\n      \"link\":  true\n    }, {\n      \"label\": I18n.t('admin.user.delete_dont_block'),\n      \"class\": \"btn\",\n      \"callback\": function(){\n        performDestroy(false);\n      }\n    }, {\n      \"label\": '\u003ci class=\"fa fa-exclamation-triangle\"\u003e\u003c/i\u003e' + I18n.t('admin.user.delete_and_block'),\n      \"class\": \"btn btn-danger\",\n      \"callback\": function(){\n        performDestroy(true);\n      }\n    }];\n\n    bootbox.dialog(message, buttons, {\"classes\": \"delete-user-modal\"});\n  },\n\n  deleteAsSpammer: function(successCallback) {\n    var user = this;\n    var message = I18n.t('flagging.delete_confirm', {posts: user.get('post_count'), topics: user.get('topic_count'), email: user.get('email'), ip_address: user.get('ip_address')});\n    var buttons = [{\n      \"label\": I18n.t(\"composer.cancel\"),\n      \"class\": \"cancel-inline\",\n      \"link\":  true\n    }, {\n      \"label\": '\u003ci class=\"fa fa-exclamation-triangle\"\u003e\u003c/i\u003e ' + I18n.t(\"flagging.yes_delete_spammer\"),\n      \"class\": \"btn btn-danger\",\n      \"callback\": function() {\n        Discourse.ajax(\"/admin/users/\" + user.get('id') + '.json', {\n          type: 'DELETE',\n          data: {delete_posts: true, block_email: true, block_urls: true, block_ip: true, context: window.location.pathname}\n        }).then(function(data) {\n          if (data.deleted) {\n            bootbox.alert(I18n.t(\"admin.user.deleted\"), function() {\n              if (successCallback) successCallback();\n            });\n          } else {\n            bootbox.alert(I18n.t(\"admin.user.delete_failed\"));\n          }\n        }, function() {\n          bootbox.alert(I18n.t(\"admin.user.delete_failed\"));\n        });\n      }\n    }];\n    bootbox.dialog(message, buttons, {\"classes\": \"flagging-delete-spammer\"});\n  },\n\n  loadDetails: function() {\n    var model = this;\n    if (model.get('loadedDetails')) { return Ember.RSVP.resolve(model); }\n\n    return Discourse.AdminUser.find(model.get('username_lower')).then(function (result) {\n      model.setProperties(result);\n      model.set('loadedDetails', true);\n    });\n  },\n\n  leaderRequirements: function() {\n    if (this.get('leader_requirements')) {\n      return Discourse.LeaderRequirements.create(this.get('leader_requirements'));\n    }\n  }.property('leader_requirements'),\n\n  suspendedBy: function() {\n    if (this.get('suspended_by')) {\n      return Discourse.AdminUser.create(this.get('suspended_by'));\n    }\n  }.property('suspended_by'),\n\n  approvedBy: function() {\n    if (this.get('approved_by')) {\n      return Discourse.AdminUser.create(this.get('approved_by'));\n    }\n  }.property('approved_by')\n\n});\n\nDiscourse.AdminUser.reopenClass({\n\n  bulkApprove: function(users) {\n    _.each(users, function(user) {\n      user.set('approved', true);\n      user.set('can_approve', false);\n      return user.set('selected', false);\n    });\n\n    bootbox.alert(I18n.t(\"admin.user.approve_bulk_success\"));\n\n    return Discourse.ajax(\"/admin/users/approve-bulk\", {\n      type: 'PUT',\n      data: {\n        users: users.map(function(u) {\n          return u.id;\n        })\n      }\n    });\n  },\n\n  bulkReject: function(users) {\n    _.each(users, function(user){\n      user.set('can_approve', false);\n      user.set('selected', false);\n    });\n\n    return Discourse.ajax(\"/admin/users/reject-bulk\", {\n      type: 'DELETE',\n      data: {\n        users: users.map(function(u) { return u.id; }),\n        context: window.location.pathname\n      }\n    });\n  },\n\n  find: function(username) {\n    return Discourse.ajax(\"/admin/users/\" + username + \".json\").then(function (result) {\n      result.loadedDetails = true;\n      return Discourse.AdminUser.create(result);\n    });\n  },\n\n  findAll: function(query, filter) {\n    return Discourse.ajax(\"/admin/users/list/\" + query + \".json\", {\n      data: filter\n    }).then(function(users) {\n      return users.map(function(u) {\n        return Discourse.AdminUser.create(u);\n      });\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing an API key in the system

  @class ApiKey
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ApiKey = Discourse.Model.extend({

  /**
    Regenerates the api key

    @method regenerate
    @returns {Promise} a promise that resolves to the key
  **/
  regenerate: function() {
    var self = this;
    return Discourse.ajax('/admin/api/key', {type: 'PUT', data: {id: this.get('id')}}).then(function (result) {
      self.set('key', result.api_key.key);
      return self;
    });
  },

  /**
    Revokes the current key

    @method revoke
    @returns {Promise} a promise that resolves when the key has been revoked
  **/
  revoke: function() {
    return Discourse.ajax('/admin/api/key', {type: 'DELETE', data: {id: this.get('id')}});
  }

});

Discourse.ApiKey.reopenClass({

  /**
    Creates an API key instance with internal user object

    @method create
    @param {...} var_args the properties to initialize this with
    @returns {Discourse.ApiKey} the ApiKey instance
  **/
  create: function() {
    var result = this._super.apply(this, arguments);
    if (result.user) {
      result.user = Discourse.AdminUser.create(result.user);
    }
    return result;
  },

  /**
    Finds a list of API keys

    @method find
    @returns {Promise} a promise that resolves to the array of `Discourse.ApiKey` instances
  **/
  find: function() {
    return Discourse.ajax("/admin/api").then(function(keys) {
      return keys.map(function (key) {
        return Discourse.ApiKey.create(key);
      });
    });
  },

  /**
    Generates a master api key and returns it.

    @method generateMasterKey
    @returns {Promise} a promise that resolves to a master `Discourse.ApiKey`
  **/
  generateMasterKey: function() {
    return Discourse.ajax("/admin/api/key", {type: 'POST'}).then(function (result) {
      return Discourse.ApiKey.create(result.api_key);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/api_key.js'] = "/**\n  Our data model for representing an API key in the system\n\n  @class ApiKey\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ApiKey = Discourse.Model.extend({\n\n  /**\n    Regenerates the api key\n\n    @method regenerate\n    @returns {Promise} a promise that resolves to the key\n  **/\n  regenerate: function() {\n    var self = this;\n    return Discourse.ajax('/admin/api/key', {type: 'PUT', data: {id: this.get('id')}}).then(function (result) {\n      self.set('key', result.api_key.key);\n      return self;\n    });\n  },\n\n  /**\n    Revokes the current key\n\n    @method revoke\n    @returns {Promise} a promise that resolves when the key has been revoked\n  **/\n  revoke: function() {\n    return Discourse.ajax('/admin/api/key', {type: 'DELETE', data: {id: this.get('id')}});\n  }\n\n});\n\nDiscourse.ApiKey.reopenClass({\n\n  /**\n    Creates an API key instance with internal user object\n\n    @method create\n    @param {...} var_args the properties to initialize this with\n    @returns {Discourse.ApiKey} the ApiKey instance\n  **/\n  create: function() {\n    var result = this._super.apply(this, arguments);\n    if (result.user) {\n      result.user = Discourse.AdminUser.create(result.user);\n    }\n    return result;\n  },\n\n  /**\n    Finds a list of API keys\n\n    @method find\n    @returns {Promise} a promise that resolves to the array of `Discourse.ApiKey` instances\n  **/\n  find: function() {\n    return Discourse.ajax(\"/admin/api\").then(function(keys) {\n      return keys.map(function (key) {\n        return Discourse.ApiKey.create(key);\n      });\n    });\n  },\n\n  /**\n    Generates a master api key and returns it.\n\n    @method generateMasterKey\n    @returns {Promise} a promise that resolves to a master `Discourse.ApiKey`\n  **/\n  generateMasterKey: function() {\n    return Discourse.ajax(\"/admin/api/key\", {type: 'POST'}).then(function (result) {\n      return Discourse.ApiKey.create(result.api_key);\n    });\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Data model for representing a backup

  @class Backup
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.Backup = Discourse.Model.extend({

  /**
    Destroys the current backup

    @method destroy
    @returns {Promise} a promise that resolves when the backup has been destroyed
  **/
  destroy: function() {
    return Discourse.ajax("/admin/backups/" + this.get("filename"), { type: "DELETE" });
  },

  /**
    Starts the restoration of the current backup

    @method restore
    @returns {Promise} a promise that resolves when the backup has started being restored
  **/
  restore: function() {
    return Discourse.ajax("/admin/backups/" + this.get("filename") + "/restore", { type: "POST" });
  }

});

Discourse.Backup.reopenClass({

  /**
    Finds a list of backups

    @method find
    @returns {Promise} a promise that resolves to the array of {Discourse.Backup} backup
  **/
  find: function() {
    return PreloadStore.getAndRemove("backups", function() {
      return Discourse.ajax("/admin/backups.json");
    }).then(function(backups) {
      return backups.map(function (backup) { return Discourse.Backup.create(backup); });
    });
  },

  /**
    Starts a backup

    @method start
    @returns {Promise} a promise that resolves when the backup has started
  **/
  start: function (withUploads) {
    if (withUploads === undefined) { withUploads = true; }
    return Discourse.ajax("/admin/backups", { type: "POST", data: { with_uploads: withUploads } }).then(function(result) {
      if (!result.success) { bootbox.alert(result.message); }
    });
  },

  /**
    Cancels a backup

    @method cancel
    @returns {Promise} a promise that resolves when the backup has been cancelled
  **/
  cancel: function() {
    return Discourse.ajax("/admin/backups/cancel.json").then(function(result) {
      if (!result.success) { bootbox.alert(result.message); }
    });
  },

  /**
    Rollbacks the database to the previous working state

    @method rollback
    @returns {Promise} a promise that resolves when the rollback is done
  **/
  rollback: function() {
    return Discourse.ajax("/admin/backups/rollback.json").then(function(result) {
      if (!result.success) {
        bootbox.alert(result.message);
      } else {
        // redirect to homepage (session might be lost)
        window.location.pathname = Discourse.getURL("/");
      }
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/backup.js'] = "/**\n  Data model for representing a backup\n\n  @class Backup\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.Backup = Discourse.Model.extend({\n\n  /**\n    Destroys the current backup\n\n    @method destroy\n    @returns {Promise} a promise that resolves when the backup has been destroyed\n  **/\n  destroy: function() {\n    return Discourse.ajax(\"/admin/backups/\" + this.get(\"filename\"), { type: \"DELETE\" });\n  },\n\n  /**\n    Starts the restoration of the current backup\n\n    @method restore\n    @returns {Promise} a promise that resolves when the backup has started being restored\n  **/\n  restore: function() {\n    return Discourse.ajax(\"/admin/backups/\" + this.get(\"filename\") + \"/restore\", { type: \"POST\" });\n  }\n\n});\n\nDiscourse.Backup.reopenClass({\n\n  /**\n    Finds a list of backups\n\n    @method find\n    @returns {Promise} a promise that resolves to the array of {Discourse.Backup} backup\n  **/\n  find: function() {\n    return PreloadStore.getAndRemove(\"backups\", function() {\n      return Discourse.ajax(\"/admin/backups.json\");\n    }).then(function(backups) {\n      return backups.map(function (backup) { return Discourse.Backup.create(backup); });\n    });\n  },\n\n  /**\n    Starts a backup\n\n    @method start\n    @returns {Promise} a promise that resolves when the backup has started\n  **/\n  start: function (withUploads) {\n    if (withUploads === undefined) { withUploads = true; }\n    return Discourse.ajax(\"/admin/backups\", { type: \"POST\", data: { with_uploads: withUploads } }).then(function(result) {\n      if (!result.success) { bootbox.alert(result.message); }\n    });\n  },\n\n  /**\n    Cancels a backup\n\n    @method cancel\n    @returns {Promise} a promise that resolves when the backup has been cancelled\n  **/\n  cancel: function() {\n    return Discourse.ajax(\"/admin/backups/cancel.json\").then(function(result) {\n      if (!result.success) { bootbox.alert(result.message); }\n    });\n  },\n\n  /**\n    Rollbacks the database to the previous working state\n\n    @method rollback\n    @returns {Promise} a promise that resolves when the rollback is done\n  **/\n  rollback: function() {\n    return Discourse.ajax(\"/admin/backups/rollback.json\").then(function(result) {\n      if (!result.success) {\n        bootbox.alert(result.message);\n      } else {\n        // redirect to homepage (session might be lost)\n        window.location.pathname = Discourse.getURL(\"/\");\n      }\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.BackupStatus = Discourse.Model.extend({

  restoreDisabled: Em.computed.not("restoreEnabled"),

  restoreEnabled: function() {
    return this.get('allowRestore') && !this.get("isOperationRunning");
  }.property("isOperationRunning", "allowRestore")

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/backup_status.js'] = "Discourse.BackupStatus = Discourse.Model.extend({\n\n  restoreDisabled: Em.computed.not(\"restoreEnabled\"),\n\n  restoreEnabled: function() {\n    return this.get('allowRestore') \u0026\u0026 !this.get(\"isOperationRunning\");\n  }.property(\"isOperationRunning\", \"allowRestore\")\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for a color scheme.

  @class ColorScheme
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ColorScheme = Discourse.Model.extend(Ember.Copyable, {

  init: function() {
    this._super();
    this.startTrackingChanges();
  },

  description: function() {
    return "" + this.name + (this.enabled ? ' (*)' : '');
  }.property(),

  startTrackingChanges: function() {
    this.set('originals', {
      name: this.get('name'),
      enabled: this.get('enabled')
    });
  },

  copy: function() {
    var newScheme = Discourse.ColorScheme.create({name: this.get('name'), enabled: false, can_edit: true, colors: Em.A()});
    _.each(this.get('colors'), function(c){
      newScheme.colors.pushObject(Discourse.ColorSchemeColor.create({name: c.get('name'), hex: c.get('hex'), default_hex: c.get('default_hex')}));
    });
    return newScheme;
  },

  changed: function() {
    if (!this.originals) return false;
    if (this.originals['name'] !== this.get('name') || this.originals['enabled'] !== this.get('enabled')) return true;
    if (_.any(this.get('colors'), function(c){ return c.get('changed'); })) return true;
    return false;
  }.property('name', 'enabled', 'colors.@each.changed', 'saving'),

  disableSave: function() {
    return !this.get('changed') || this.get('saving') || _.any(this.get('colors'), function(c) { return !c.get('valid'); });
  }.property('changed'),

  disableEnable: function() {
    return !this.get('id') || this.get('saving');
  }.property('id', 'saving'),

  newRecord: function() {
    return (!this.get('id'));
  }.property('id'),

  save: function(opts) {
    if (this.get('is_base') || this.get('disableSave')) return;

    var self = this;
    this.set('savingStatus', I18n.t('saving'));
    this.set('saving',true);

    var data = { enabled: this.enabled };

    if (!opts || !opts.enabledOnly) {
      data.name = this.name;

      data.colors = [];
      _.each(this.get('colors'), function(c) {
        if (!self.id || c.get('changed')) {
          data.colors.pushObject({name: c.get('name'), hex: c.get('hex')});
        }
      });
    }

    return Discourse.ajax("/admin/color_schemes" + (this.id ? '/' + this.id : '') + '.json', {
      data: JSON.stringify({"color_scheme": data}),
      type: this.id ? 'PUT' : 'POST',
      dataType: 'json',
      contentType: 'application/json'
    }).then(function(result) {
      if(result.id) { self.set('id', result.id); }
      if (!opts || !opts.enabledOnly) {
        self.startTrackingChanges();
        _.each(self.get('colors'), function(c) {
          c.startTrackingChanges();
        });
      } else {
        self.set('originals.enabled', data.enabled);
      }
      self.set('savingStatus', I18n.t('saved'));
      self.set('saving', false);
      self.notifyPropertyChange('description');
    });
  },

  destroy: function() {
    if (this.id) {
      return Discourse.ajax("/admin/color_schemes/" + this.id, { type: 'DELETE' });
    }
  }

});

var ColorSchemes = Ember.ArrayProxy.extend({
  selectedItemChanged: function() {
    var selected = this.get('selectedItem');
    _.each(this.get('content'),function(i) {
      return i.set('selected', selected === i);
    });
  }.observes('selectedItem')
});

Discourse.ColorScheme.reopenClass({
  findAll: function() {
    var colorSchemes = ColorSchemes.create({ content: [], loading: true });
    Discourse.ajax('/admin/color_schemes').then(function(all) {
      _.each(all, function(colorScheme){
        colorSchemes.pushObject(Discourse.ColorScheme.create({
          id: colorScheme.id,
          name: colorScheme.name,
          enabled: colorScheme.enabled,
          is_base: colorScheme.is_base,
          colors: colorScheme.colors.map(function(c) { return Discourse.ColorSchemeColor.create({name: c.name, hex: c.hex, default_hex: c.default_hex}); })
        }));
      });
      colorSchemes.set('loading', false);
    });
    return colorSchemes;
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/color_scheme.js'] = "/**\n  Our data model for a color scheme.\n\n  @class ColorScheme\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ColorScheme = Discourse.Model.extend(Ember.Copyable, {\n\n  init: function() {\n    this._super();\n    this.startTrackingChanges();\n  },\n\n  description: function() {\n    return \"\" + this.name + (this.enabled ? ' (*)' : '');\n  }.property(),\n\n  startTrackingChanges: function() {\n    this.set('originals', {\n      name: this.get('name'),\n      enabled: this.get('enabled')\n    });\n  },\n\n  copy: function() {\n    var newScheme = Discourse.ColorScheme.create({name: this.get('name'), enabled: false, can_edit: true, colors: Em.A()});\n    _.each(this.get('colors'), function(c){\n      newScheme.colors.pushObject(Discourse.ColorSchemeColor.create({name: c.get('name'), hex: c.get('hex'), default_hex: c.get('default_hex')}));\n    });\n    return newScheme;\n  },\n\n  changed: function() {\n    if (!this.originals) return false;\n    if (this.originals['name'] !== this.get('name') || this.originals['enabled'] !== this.get('enabled')) return true;\n    if (_.any(this.get('colors'), function(c){ return c.get('changed'); })) return true;\n    return false;\n  }.property('name', 'enabled', 'colors.@each.changed', 'saving'),\n\n  disableSave: function() {\n    return !this.get('changed') || this.get('saving') || _.any(this.get('colors'), function(c) { return !c.get('valid'); });\n  }.property('changed'),\n\n  disableEnable: function() {\n    return !this.get('id') || this.get('saving');\n  }.property('id', 'saving'),\n\n  newRecord: function() {\n    return (!this.get('id'));\n  }.property('id'),\n\n  save: function(opts) {\n    if (this.get('is_base') || this.get('disableSave')) return;\n\n    var self = this;\n    this.set('savingStatus', I18n.t('saving'));\n    this.set('saving',true);\n\n    var data = { enabled: this.enabled };\n\n    if (!opts || !opts.enabledOnly) {\n      data.name = this.name;\n\n      data.colors = [];\n      _.each(this.get('colors'), function(c) {\n        if (!self.id || c.get('changed')) {\n          data.colors.pushObject({name: c.get('name'), hex: c.get('hex')});\n        }\n      });\n    }\n\n    return Discourse.ajax(\"/admin/color_schemes\" + (this.id ? '/' + this.id : '') + '.json', {\n      data: JSON.stringify({\"color_scheme\": data}),\n      type: this.id ? 'PUT' : 'POST',\n      dataType: 'json',\n      contentType: 'application/json'\n    }).then(function(result) {\n      if(result.id) { self.set('id', result.id); }\n      if (!opts || !opts.enabledOnly) {\n        self.startTrackingChanges();\n        _.each(self.get('colors'), function(c) {\n          c.startTrackingChanges();\n        });\n      } else {\n        self.set('originals.enabled', data.enabled);\n      }\n      self.set('savingStatus', I18n.t('saved'));\n      self.set('saving', false);\n      self.notifyPropertyChange('description');\n    });\n  },\n\n  destroy: function() {\n    if (this.id) {\n      return Discourse.ajax(\"/admin/color_schemes/\" + this.id, { type: 'DELETE' });\n    }\n  }\n\n});\n\nvar ColorSchemes = Ember.ArrayProxy.extend({\n  selectedItemChanged: function() {\n    var selected = this.get('selectedItem');\n    _.each(this.get('content'),function(i) {\n      return i.set('selected', selected === i);\n    });\n  }.observes('selectedItem')\n});\n\nDiscourse.ColorScheme.reopenClass({\n  findAll: function() {\n    var colorSchemes = ColorSchemes.create({ content: [], loading: true });\n    Discourse.ajax('/admin/color_schemes').then(function(all) {\n      _.each(all, function(colorScheme){\n        colorSchemes.pushObject(Discourse.ColorScheme.create({\n          id: colorScheme.id,\n          name: colorScheme.name,\n          enabled: colorScheme.enabled,\n          is_base: colorScheme.is_base,\n          colors: colorScheme.colors.map(function(c) { return Discourse.ColorSchemeColor.create({name: c.name, hex: c.hex, default_hex: c.default_hex}); })\n        }));\n      });\n      colorSchemes.set('loading', false);\n    });\n    return colorSchemes;\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for a color within a color scheme.
  (It's a funny name for a class, but Color seemed too generic for what this class is.)

  @class ColorSchemeColor
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ColorSchemeColor = Discourse.Model.extend({

  init: function() {
    this._super();
    this.startTrackingChanges();
  },

  startTrackingChanges: function() {
    this.set('originals', {hex: this.get('hex') || 'FFFFFF'});
    this.notifyPropertyChange('hex'); // force changed property to be recalculated
  },

  // Whether value has changed since it was last saved.
  changed: function() {
    if (!this.originals) return false;
    if (this.get('hex') !== this.originals['hex']) return true;
    return false;
  }.property('hex'),

  // Whether the current value is different than Discourse's default color scheme.
  overridden: function() {
    return this.get('hex') !== this.get('default_hex');
  }.property('hex', 'default_hex'),

  // Whether the saved value is different than Discourse's default color scheme.
  savedIsOverriden: function() {
    return this.get('originals').hex !== this.get('default_hex');
  }.property('hex', 'default_hex'),

  revert: function() {
    this.set('hex', this.get('default_hex'));
  },

  undo: function() {
    if (this.originals) this.set('hex', this.originals['hex']);
  },

  translatedName: function() {
    return I18n.t('admin.customize.colors.' + this.get('name') + '.name');
  }.property('name'),

  description: function() {
    return I18n.t('admin.customize.colors.' + this.get('name') + '.description');
  }.property('name'),

  /**
    brightness returns a number between 0 (darkest) to 255 (brightest).
    Undefined if hex is not a valid color.

    @property brightness
  **/
  brightness: function() {
    var hex = this.get('hex');
    if (hex.length === 6 || hex.length === 3) {
      if (hex.length === 3) {
        hex = hex.substr(0,1) + hex.substr(0,1) + hex.substr(1,1) + hex.substr(1,1) + hex.substr(2,1) + hex.substr(2,1);
      }
      return Math.round(((parseInt('0x'+hex.substr(0,2)) * 299) + (parseInt('0x'+hex.substr(2,2)) * 587) + (parseInt('0x'+hex.substr(4,2)) * 114)) /1000);
    }
  }.property('hex'),

  hexValueChanged: function() {
    if (this.get('hex')) {
      this.set('hex', this.get('hex').toString().replace(/[^0-9a-fA-F]/g, ""));
    }
  }.observes('hex'),

  valid: function() {
    return this.get('hex').match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/) !== null;
  }.property('hex')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/color_scheme_color.js'] = "/**\n  Our data model for a color within a color scheme.\n  (It's a funny name for a class, but Color seemed too generic for what this class is.)\n\n  @class ColorSchemeColor\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ColorSchemeColor = Discourse.Model.extend({\n\n  init: function() {\n    this._super();\n    this.startTrackingChanges();\n  },\n\n  startTrackingChanges: function() {\n    this.set('originals', {hex: this.get('hex') || 'FFFFFF'});\n    this.notifyPropertyChange('hex'); // force changed property to be recalculated\n  },\n\n  // Whether value has changed since it was last saved.\n  changed: function() {\n    if (!this.originals) return false;\n    if (this.get('hex') !== this.originals['hex']) return true;\n    return false;\n  }.property('hex'),\n\n  // Whether the current value is different than Discourse's default color scheme.\n  overridden: function() {\n    return this.get('hex') !== this.get('default_hex');\n  }.property('hex', 'default_hex'),\n\n  // Whether the saved value is different than Discourse's default color scheme.\n  savedIsOverriden: function() {\n    return this.get('originals').hex !== this.get('default_hex');\n  }.property('hex', 'default_hex'),\n\n  revert: function() {\n    this.set('hex', this.get('default_hex'));\n  },\n\n  undo: function() {\n    if (this.originals) this.set('hex', this.originals['hex']);\n  },\n\n  translatedName: function() {\n    return I18n.t('admin.customize.colors.' + this.get('name') + '.name');\n  }.property('name'),\n\n  description: function() {\n    return I18n.t('admin.customize.colors.' + this.get('name') + '.description');\n  }.property('name'),\n\n  /**\n    brightness returns a number between 0 (darkest) to 255 (brightest).\n    Undefined if hex is not a valid color.\n\n    @property brightness\n  **/\n  brightness: function() {\n    var hex = this.get('hex');\n    if (hex.length === 6 || hex.length === 3) {\n      if (hex.length === 3) {\n        hex = hex.substr(0,1) + hex.substr(0,1) + hex.substr(1,1) + hex.substr(1,1) + hex.substr(2,1) + hex.substr(2,1);\n      }\n      return Math.round(((parseInt('0x'+hex.substr(0,2)) * 299) + (parseInt('0x'+hex.substr(2,2)) * 587) + (parseInt('0x'+hex.substr(4,2)) * 114)) /1000);\n    }\n  }.property('hex'),\n\n  hexValueChanged: function() {\n    if (this.get('hex')) {\n      this.set('hex', this.get('hex').toString().replace(/[^0-9a-fA-F]/g, \"\"));\n    }\n  }.observes('hex'),\n\n  valid: function() {\n    return this.get('hex').match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/) !== null;\n  }.property('hex')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing an email log.

  @class EmailLog
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailLog = Discourse.Model.extend({});

Discourse.EmailLog.reopenClass({

  create: function(attrs) {
    attrs = attrs || {};

    if (attrs.user) {
      attrs.user = Discourse.AdminUser.create(attrs.user);
    }

    return this._super(attrs);
  },

  findAll: function(filter) {
    filter = filter || {};
    var status = filter.status || "all";
    filter = _.omit(filter, "status");

    return Discourse.ajax("/admin/email/" + status + ".json", { data: filter }).then(function(logs) {
      return _.map(logs, function (log) {
        return Discourse.EmailLog.create(log);
      });
    });
  }
});




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/email_log.js'] = "/**\n  Our data model for representing an email log.\n\n  @class EmailLog\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.EmailLog = Discourse.Model.extend({});\n\nDiscourse.EmailLog.reopenClass({\n\n  create: function(attrs) {\n    attrs = attrs || {};\n\n    if (attrs.user) {\n      attrs.user = Discourse.AdminUser.create(attrs.user);\n    }\n\n    return this._super(attrs);\n  },\n\n  findAll: function(filter) {\n    filter = filter || {};\n    var status = filter.status || \"all\";\n    filter = _.omit(filter, \"status\");\n\n    return Discourse.ajax(\"/admin/email/\" + status + \".json\", { data: filter }).then(function(logs) {\n      return _.map(logs, function (log) {\n        return Discourse.EmailLog.create(log);\n      });\n    });\n  }\n});\n\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for showing a preview of an email

  @class EmailPreview
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailPreview = Discourse.Model.extend({});

Discourse.EmailPreview.reopenClass({
  findDigest: function(lastSeenAt) {

    if (Em.isEmpty(lastSeenAt)) {
      lastSeenAt = moment().subtract(7, 'days').format('YYYY-MM-DD');
    }

    return Discourse.ajax("/admin/email/preview-digest.json", {
      data: {last_seen_at: lastSeenAt}
    }).then(function (result) {
      return Discourse.EmailPreview.create(result);
    });
  }
});




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/email_preview.js'] = "/**\n  Our data model for showing a preview of an email\n\n  @class EmailPreview\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.EmailPreview = Discourse.Model.extend({});\n\nDiscourse.EmailPreview.reopenClass({\n  findDigest: function(lastSeenAt) {\n\n    if (Em.isEmpty(lastSeenAt)) {\n      lastSeenAt = moment().subtract(7, 'days').format('YYYY-MM-DD');\n    }\n\n    return Discourse.ajax(\"/admin/email/preview-digest.json\", {\n      data: {last_seen_at: lastSeenAt}\n    }).then(function (result) {\n      return Discourse.EmailPreview.create(result);\n    });\n  }\n});\n\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing the current email settings

  @class EmailSettings
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailSettings = Discourse.Model.extend({});

Discourse.EmailSettings.reopenClass({
  find: function() {
    return Discourse.ajax("/admin/email.json").then(function (settings) {
      return Discourse.EmailSettings.create(settings);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/email_settings.js'] = "/**\n  Our data model for representing the current email settings\n\n  @class EmailSettings\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.EmailSettings = Discourse.Model.extend({});\n\nDiscourse.EmailSettings.reopenClass({\n  find: function() {\n    return Discourse.ajax(\"/admin/email.json\").then(function (settings) {\n      return Discourse.EmailSettings.create(settings);\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Data model for representing an export

  @class ExportCsv
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ExportCsv = Discourse.Model.extend({});

Discourse.ExportCsv.reopenClass({
  /**
    Exports user list

    @method export_user_list
  **/
  exportUserList: function() {
    return Discourse.ajax("/admin/export_csv/users.json").then(function(result) {
      if (result.success) {
        bootbox.alert(I18n.t("admin.export_csv.success"));
      } else {
        bootbox.alert(I18n.t("admin.export_csv.failed"));
      }
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/export_csv.js'] = "/**\n  Data model for representing an export\n\n  @class ExportCsv\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ExportCsv = Discourse.Model.extend({});\n\nDiscourse.ExportCsv.reopenClass({\n  /**\n    Exports user list\n\n    @method export_user_list\n  **/\n  exportUserList: function() {\n    return Discourse.ajax(\"/admin/export_csv/users.json\").then(function(result) {\n      if (result.success) {\n        bootbox.alert(I18n.t(\"admin.export_csv.success\"));\n      } else {\n        bootbox.alert(I18n.t(\"admin.export_csv.failed\"));\n      }\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with flagged posts.

  @class FlaggedPost
  @extends Discourse.Post
  @namespace Discourse
  @module Discourse
**/

Discourse.FlaggedPost = Discourse.Post.extend({

  summary: function () {
    return _(this.post_actions)
      .groupBy(function (a) { return a.post_action_type_id; })
      .map(function (v,k) { return I18n.t('admin.flags.summary.action_type_' + k, { count: v.length }); })
      .join(',');
  }.property(),

  flaggers: function () {
    var self = this;
    var flaggers = [];

    _.each(this.post_actions, function (postAction) {
      flaggers.push({
        user: self.userLookup[postAction.user_id],
        topic: self.topicLookup[postAction.topic_id],
        flagType: I18n.t('admin.flags.summary.action_type_' + postAction.post_action_type_id, { count: 1 }),
        flaggedAt: postAction.created_at,
        disposedBy: postAction.disposed_by_id ? self.userLookup[postAction.disposed_by_id] : null,
        disposedAt: postAction.disposed_at,
        dispositionIcon: self.dispositionIcon(postAction.disposition),
        tookAction: postAction.staff_took_action
      });
    });

    return flaggers;
  }.property(),

  dispositionIcon: function (disposition) {
    if (!disposition) { return null; }
    var icon, title = I18n.t('admin.flags.dispositions.' + disposition);
    switch (disposition) {
      case "deferred": { icon = "fa-external-link"; break; }
      case "agreed": { icon = "fa-thumbs-o-up"; break; }
      case "disagreed": { icon = "fa-thumbs-o-down"; break; }
    }
    return "<i class='fa " + icon + "' title='" + title + "'></i>";
  },

  wasEdited: function () {
    if (this.blank("last_revised_at")) { return false; }
    var lastRevisedAt = Date.parse(this.get("last_revised_at"));
    return _.some(this.get("post_actions"), function (postAction) {
      return Date.parse(postAction.created_at) < lastRevisedAt;
    });
  }.property("last_revised_at", "post_actions.@each.created_at"),

  conversations: function () {
    var self = this;
    var conversations = [];

    _.each(this.post_actions, function (postAction) {
      if (postAction.conversation) {
        var conversation = {
          permalink: postAction.permalink,
          hasMore: postAction.conversation.has_more,
          response: {
            excerpt: postAction.conversation.response.excerpt,
            user: self.userLookup[postAction.conversation.response.user_id]
          }
        };

        if (postAction.conversation.reply) {
          conversation["reply"] = {
            excerpt: postAction.conversation.reply.excerpt,
            user: self.userLookup[postAction.conversation.reply.user_id]
          };
        }

        conversations.push(conversation);
      }
    });

    return conversations;
  }.property(),

  user: function() {
    return this.userLookup[this.user_id];
  }.property(),

  topic: function () {
    return this.topicLookup[this.topic_id];
  }.property(),

  flaggedForSpam: function() {
    return !_.every(this.get('post_actions'), function(action) { return action.name_key !== 'spam'; });
  }.property('post_actions.@each.name_key'),

  topicFlagged: function() {
    return _.any(this.get('post_actions'), function(action) { return action.targets_topic; });
  }.property('post_actions.@each.targets_topic'),

  postAuthorFlagged: function() {
    return _.any(this.get('post_actions'), function(action) { return !action.targets_topic; });
  }.property('post_actions.@each.targets_topic'),

  canDeleteAsSpammer: function() {
    return Discourse.User.currentProp('staff') && this.get('flaggedForSpam') && this.get('user.can_delete_all_posts') && this.get('user.can_be_deleted');
  }.property('flaggedForSpam'),

  deletePost: function() {
    if (this.get('post_number') === 1) {
      return Discourse.ajax('/t/' + this.topic_id, { type: 'DELETE', cache: false });
    } else {
      return Discourse.ajax('/posts/' + this.id, { type: 'DELETE', cache: false });
    }
  },

  disagreeFlags: function () {
    return Discourse.ajax('/admin/flags/disagree/' + this.id, { type: 'POST', cache: false });
  },

  deferFlags: function (deletePost) {
    return Discourse.ajax('/admin/flags/defer/' + this.id, { type: 'POST', cache: false, data: { delete_post: deletePost } });
  },

  agreeFlags: function (actionOnPost) {
    return Discourse.ajax('/admin/flags/agree/' + this.id, { type: 'POST', cache: false, data: { action_on_post: actionOnPost } });
  },

  postHidden: Em.computed.alias('hidden'),

  extraClasses: function() {
    var classes = [];
    if (this.get('hidden')) { classes.push('hidden-post'); }
    if (this.get('deleted')) { classes.push('deleted'); }
    return classes.join(' ');
  }.property(),

  deleted: Em.computed.or('deleted_at', 'topic_deleted_at')

});

Discourse.FlaggedPost.reopenClass({
  findAll: function (filter, offset) {
    offset = offset || 0;

    var result = Em.A();
    result.set('loading', true);

    return Discourse.ajax('/admin/flags/' + filter + '.json?offset=' + offset).then(function (data) {
      // users
      var userLookup = {};
      _.each(data.users, function (user) {
        userLookup[user.id] = Discourse.AdminUser.create(user);
      });

      // topics
      var topicLookup = {};
      _.each(data.topics, function (topic) {
        topicLookup[topic.id] = Discourse.Topic.create(topic);
      });

      // posts
      _.each(data.posts, function (post) {
        var f = Discourse.FlaggedPost.create(post);
        f.userLookup = userLookup;
        f.topicLookup = topicLookup;
        result.pushObject(f);
      });

      result.set('loading', false);

      return result;
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/flagged_post.js'] = "/**\n  Our data model for interacting with flagged posts.\n\n  @class FlaggedPost\n  @extends Discourse.Post\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.FlaggedPost = Discourse.Post.extend({\n\n  summary: function () {\n    return _(this.post_actions)\n      .groupBy(function (a) { return a.post_action_type_id; })\n      .map(function (v,k) { return I18n.t('admin.flags.summary.action_type_' + k, { count: v.length }); })\n      .join(',');\n  }.property(),\n\n  flaggers: function () {\n    var self = this;\n    var flaggers = [];\n\n    _.each(this.post_actions, function (postAction) {\n      flaggers.push({\n        user: self.userLookup[postAction.user_id],\n        topic: self.topicLookup[postAction.topic_id],\n        flagType: I18n.t('admin.flags.summary.action_type_' + postAction.post_action_type_id, { count: 1 }),\n        flaggedAt: postAction.created_at,\n        disposedBy: postAction.disposed_by_id ? self.userLookup[postAction.disposed_by_id] : null,\n        disposedAt: postAction.disposed_at,\n        dispositionIcon: self.dispositionIcon(postAction.disposition),\n        tookAction: postAction.staff_took_action\n      });\n    });\n\n    return flaggers;\n  }.property(),\n\n  dispositionIcon: function (disposition) {\n    if (!disposition) { return null; }\n    var icon, title = I18n.t('admin.flags.dispositions.' + disposition);\n    switch (disposition) {\n      case \"deferred\": { icon = \"fa-external-link\"; break; }\n      case \"agreed\": { icon = \"fa-thumbs-o-up\"; break; }\n      case \"disagreed\": { icon = \"fa-thumbs-o-down\"; break; }\n    }\n    return \"\u003ci class='fa \" + icon + \"' title='\" + title + \"'\u003e\u003c/i\u003e\";\n  },\n\n  wasEdited: function () {\n    if (this.blank(\"last_revised_at\")) { return false; }\n    var lastRevisedAt = Date.parse(this.get(\"last_revised_at\"));\n    return _.some(this.get(\"post_actions\"), function (postAction) {\n      return Date.parse(postAction.created_at) \u003c lastRevisedAt;\n    });\n  }.property(\"last_revised_at\", \"post_actions.@each.created_at\"),\n\n  conversations: function () {\n    var self = this;\n    var conversations = [];\n\n    _.each(this.post_actions, function (postAction) {\n      if (postAction.conversation) {\n        var conversation = {\n          permalink: postAction.permalink,\n          hasMore: postAction.conversation.has_more,\n          response: {\n            excerpt: postAction.conversation.response.excerpt,\n            user: self.userLookup[postAction.conversation.response.user_id]\n          }\n        };\n\n        if (postAction.conversation.reply) {\n          conversation[\"reply\"] = {\n            excerpt: postAction.conversation.reply.excerpt,\n            user: self.userLookup[postAction.conversation.reply.user_id]\n          };\n        }\n\n        conversations.push(conversation);\n      }\n    });\n\n    return conversations;\n  }.property(),\n\n  user: function() {\n    return this.userLookup[this.user_id];\n  }.property(),\n\n  topic: function () {\n    return this.topicLookup[this.topic_id];\n  }.property(),\n\n  flaggedForSpam: function() {\n    return !_.every(this.get('post_actions'), function(action) { return action.name_key !== 'spam'; });\n  }.property('post_actions.@each.name_key'),\n\n  topicFlagged: function() {\n    return _.any(this.get('post_actions'), function(action) { return action.targets_topic; });\n  }.property('post_actions.@each.targets_topic'),\n\n  postAuthorFlagged: function() {\n    return _.any(this.get('post_actions'), function(action) { return !action.targets_topic; });\n  }.property('post_actions.@each.targets_topic'),\n\n  canDeleteAsSpammer: function() {\n    return Discourse.User.currentProp('staff') \u0026\u0026 this.get('flaggedForSpam') \u0026\u0026 this.get('user.can_delete_all_posts') \u0026\u0026 this.get('user.can_be_deleted');\n  }.property('flaggedForSpam'),\n\n  deletePost: function() {\n    if (this.get('post_number') === 1) {\n      return Discourse.ajax('/t/' + this.topic_id, { type: 'DELETE', cache: false });\n    } else {\n      return Discourse.ajax('/posts/' + this.id, { type: 'DELETE', cache: false });\n    }\n  },\n\n  disagreeFlags: function () {\n    return Discourse.ajax('/admin/flags/disagree/' + this.id, { type: 'POST', cache: false });\n  },\n\n  deferFlags: function (deletePost) {\n    return Discourse.ajax('/admin/flags/defer/' + this.id, { type: 'POST', cache: false, data: { delete_post: deletePost } });\n  },\n\n  agreeFlags: function (actionOnPost) {\n    return Discourse.ajax('/admin/flags/agree/' + this.id, { type: 'POST', cache: false, data: { action_on_post: actionOnPost } });\n  },\n\n  postHidden: Em.computed.alias('hidden'),\n\n  extraClasses: function() {\n    var classes = [];\n    if (this.get('hidden')) { classes.push('hidden-post'); }\n    if (this.get('deleted')) { classes.push('deleted'); }\n    return classes.join(' ');\n  }.property(),\n\n  deleted: Em.computed.or('deleted_at', 'topic_deleted_at')\n\n});\n\nDiscourse.FlaggedPost.reopenClass({\n  findAll: function (filter, offset) {\n    offset = offset || 0;\n\n    var result = Em.A();\n    result.set('loading', true);\n\n    return Discourse.ajax('/admin/flags/' + filter + '.json?offset=' + offset).then(function (data) {\n      // users\n      var userLookup = {};\n      _.each(data.users, function (user) {\n        userLookup[user.id] = Discourse.AdminUser.create(user);\n      });\n\n      // topics\n      var topicLookup = {};\n      _.each(data.topics, function (topic) {\n        topicLookup[topic.id] = Discourse.Topic.create(topic);\n      });\n\n      // posts\n      _.each(data.posts, function (post) {\n        var f = Discourse.FlaggedPost.create(post);\n        f.userLookup = userLookup;\n        f.topicLookup = topicLookup;\n        result.pushObject(f);\n      });\n\n      result.set('loading', false);\n\n      return result;\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A model for a git commit to the discourse repo, fetched from the github.com api.

  @class GithubCommit
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.GithubCommit = Discourse.Model.extend({
  gravatarUrl: function(){
    if( this.get('author') && this.get('author.gravatar_id') ){
      return("https://www.gravatar.com/avatar/" + this.get('author.gravatar_id') + ".png?s=38&r=pg&d=identicon");
    } else {
      return "https://www.gravatar.com/avatar/b30fff48d257cdd17c4437afac19fd30.png?s=38&r=pg&d=identicon";
    }
  }.property("commit"),

  commitUrl: function(){
    return("https://github.com/discourse/discourse/commit/" + this.get('sha'));
  }.property("sha"),

  timeAgo: function() {
    return moment(this.get('commit.committer.date')).relativeAge({format: 'medium', leaveAgo: true});
  }.property("commit.committer.date")
});

Discourse.GithubCommit.reopenClass({
  findAll: function() {
    var result = Em.A();
    Discourse.ajax( "https://api.github.com/repos/discourse/discourse/commits?callback=callback", {
      dataType: 'jsonp',
      type: 'get',
      data: { per_page: 40 }
    }).then(function (response) {
      _.each(response.data,function(commit) {
        result.pushObject( Discourse.GithubCommit.create(commit) );
      });
    });
    return result;
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/github_commit.js'] = "/**\n  A model for a git commit to the discourse repo, fetched from the github.com api.\n\n  @class GithubCommit\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.GithubCommit = Discourse.Model.extend({\n  gravatarUrl: function(){\n    if( this.get('author') \u0026\u0026 this.get('author.gravatar_id') ){\n      return(\"https://www.gravatar.com/avatar/\" + this.get('author.gravatar_id') + \".png?s=38\u0026r=pg\u0026d=identicon\");\n    } else {\n      return \"https://www.gravatar.com/avatar/b30fff48d257cdd17c4437afac19fd30.png?s=38\u0026r=pg\u0026d=identicon\";\n    }\n  }.property(\"commit\"),\n\n  commitUrl: function(){\n    return(\"https://github.com/discourse/discourse/commit/\" + this.get('sha'));\n  }.property(\"sha\"),\n\n  timeAgo: function() {\n    return moment(this.get('commit.committer.date')).relativeAge({format: 'medium', leaveAgo: true});\n  }.property(\"commit.committer.date\")\n});\n\nDiscourse.GithubCommit.reopenClass({\n  findAll: function() {\n    var result = Em.A();\n    Discourse.ajax( \"https://api.github.com/repos/discourse/discourse/commits?callback=callback\", {\n      dataType: 'jsonp',\n      type: 'get',\n      data: { per_page: 40 }\n    }).then(function (response) {\n      _.each(response.data,function(commit) {\n        result.pushObject( Discourse.GithubCommit.create(commit) );\n      });\n    });\n    return result;\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.LeaderRequirements = Discourse.Model.extend({
  days_visited_percent: function() {
    return ((this.get('days_visited') * 100) / this.get('time_period'));
  }.property('days_visited', 'time_period'),

  min_days_visited_percent: function() {
    return ((this.get('min_days_visited') * 100) / this.get('time_period'));
  }.property('min_days_visited', 'time_period'),

  met: function() {
    return {
      days_visited: this.get('days_visited') >= this.get('min_days_visited'),
      topics_replied_to: this.get('num_topics_replied_to') >= this.get('min_topics_replied_to'),
      topics_viewed: this.get('topics_viewed') >= this.get('min_topics_viewed'),
      posts_read: this.get('posts_read') >= this.get('min_posts_read'),
      topics_viewed_all_time: this.get('topics_viewed_all_time') >= this.get('min_topics_viewed_all_time'),
      posts_read_all_time: this.get('posts_read_all_time') >= this.get('min_posts_read_all_time'),
      flagged_posts: this.get('num_flagged_posts') <= this.get('max_flagged_posts'),
      flagged_by_users: this.get('num_flagged_by_users') <= this.get('max_flagged_by_users'),
      likes_given: this.get('num_likes_given') >= this.get('min_likes_given'),
      likes_received: this.get('num_likes_received') >= this.get('min_likes_received')
    };
  }.property('days_visited', 'min_days_visited',
             'num_topics_replied_to', 'min_topics_replied_to',
             'topics_viewed', 'min_topics_viewed',
             'posts_read', 'min_posts_read',
             'num_flagged_posts', 'max_flagged_posts',
             'topics_viewed_all_time', 'min_topics_viewed_all_time',
             'posts_read_all_time', 'min_posts_read_all_time',
             'num_flagged_by_users', 'max_flagged_by_users',
             'num_likes_given', 'min_likes_given',
             'num_likes_received', 'min_likes_received')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/leader_requirements.js'] = "Discourse.LeaderRequirements = Discourse.Model.extend({\n  days_visited_percent: function() {\n    return ((this.get('days_visited') * 100) / this.get('time_period'));\n  }.property('days_visited', 'time_period'),\n\n  min_days_visited_percent: function() {\n    return ((this.get('min_days_visited') * 100) / this.get('time_period'));\n  }.property('min_days_visited', 'time_period'),\n\n  met: function() {\n    return {\n      days_visited: this.get('days_visited') \u003e= this.get('min_days_visited'),\n      topics_replied_to: this.get('num_topics_replied_to') \u003e= this.get('min_topics_replied_to'),\n      topics_viewed: this.get('topics_viewed') \u003e= this.get('min_topics_viewed'),\n      posts_read: this.get('posts_read') \u003e= this.get('min_posts_read'),\n      topics_viewed_all_time: this.get('topics_viewed_all_time') \u003e= this.get('min_topics_viewed_all_time'),\n      posts_read_all_time: this.get('posts_read_all_time') \u003e= this.get('min_posts_read_all_time'),\n      flagged_posts: this.get('num_flagged_posts') \u003c= this.get('max_flagged_posts'),\n      flagged_by_users: this.get('num_flagged_by_users') \u003c= this.get('max_flagged_by_users'),\n      likes_given: this.get('num_likes_given') \u003e= this.get('min_likes_given'),\n      likes_received: this.get('num_likes_received') \u003e= this.get('min_likes_received')\n    };\n  }.property('days_visited', 'min_days_visited',\n             'num_topics_replied_to', 'min_topics_replied_to',\n             'topics_viewed', 'min_topics_viewed',\n             'posts_read', 'min_posts_read',\n             'num_flagged_posts', 'max_flagged_posts',\n             'topics_viewed_all_time', 'min_topics_viewed_all_time',\n             'posts_read_all_time', 'min_posts_read_all_time',\n             'num_flagged_by_users', 'max_flagged_by_users',\n             'num_likes_given', 'min_likes_given',\n             'num_likes_received', 'min_likes_received')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.Report = Discourse.Model.extend({
  reportUrl: function() {
    return("/admin/reports/" + this.get('type'));
  }.property('type'),

  valueAt: function(numDaysAgo) {
    if (this.data) {
      var wantedDate = moment().subtract(numDaysAgo, 'days').format('YYYY-MM-DD');
      var item = this.data.find( function(d) { return d.x === wantedDate; } );
      if (item) {
        return item.y;
      }
    }
    return 0;
  },

  sumDays: function(startDaysAgo, endDaysAgo) {
    if (this.data) {
      var earliestDate = moment().subtract(endDaysAgo, 'days').startOf('day');
      var latestDate = moment().subtract(startDaysAgo, 'days').startOf('day');
      var d, sum = 0;
      _.each(this.data,function(datum){
        d = moment(datum.x);
        if(d >= earliestDate && d <= latestDate) {
          sum += datum.y;
        }
      });
      return sum;
    }
  },

  todayCount: function() {
    return this.valueAt(0);
  }.property('data'),

  yesterdayCount: function() {
    return this.valueAt(1);
  }.property('data'),

  lastSevenDaysCount: function() {
    return this.sumDays(1,7);
  }.property('data'),

  lastThirtyDaysCount: function() {
    return this.sumDays(1,30);
  }.property('data'),

  sevenDaysAgoCount: function() {
    return this.valueAt(7);
  }.property('data'),

  thirtyDaysAgoCount: function() {
    return this.valueAt(30);
  }.property('data'),

  yesterdayTrend: function() {
    var yesterdayVal = this.valueAt(1);
    var twoDaysAgoVal = this.valueAt(2);
    if ( yesterdayVal > twoDaysAgoVal ) {
      return 'trending-up';
    } else if ( yesterdayVal < twoDaysAgoVal ) {
      return 'trending-down';
    } else {
      return 'no-change';
    }
  }.property('data'),

  sevenDayTrend: function() {
    var currentPeriod = this.sumDays(1,7);
    var prevPeriod = this.sumDays(8,14);
    if ( currentPeriod > prevPeriod ) {
      return 'trending-up';
    } else if ( currentPeriod < prevPeriod ) {
      return 'trending-down';
    } else {
      return 'no-change';
    }
  }.property('data'),

  thirtyDayTrend: function() {
    if( this.get('prev30Days') ) {
      var currentPeriod = this.sumDays(1,30);
      if( currentPeriod > this.get('prev30Days') ) {
        return 'trending-up';
      } else if ( currentPeriod < this.get('prev30Days') ) {
        return 'trending-down';
      }
    }
    return 'no-change';
  }.property('data', 'prev30Days'),

  icon: function() {
    switch( this.get('type') ) {
    case 'flags':
      return 'fa-flag';
    case 'likes':
      return 'fa-heart';
    default:
      return null;
    }
  }.property('type'),

  percentChangeString: function(val1, val2) {
    var val = ((val1 - val2) / val2) * 100;
    if( isNaN(val) || !isFinite(val) ) {
      return null;
    } else if( val > 0 ) {
      return '+' + val.toFixed(0) + '%';
    } else {
      return val.toFixed(0) + '%';
    }
  },

  changeTitle: function(val1, val2, prevPeriodString) {
    var title = '';
    var percentChange = this.percentChangeString(val1, val2);
    if( percentChange ) {
      title += percentChange + ' change. ';
    }
    title += 'Was ' + val2 + ' ' + prevPeriodString + '.';
    return title;
  },

  yesterdayCountTitle: function() {
    return this.changeTitle( this.valueAt(1), this.valueAt(2),'two days ago');
  }.property('data'),

  sevenDayCountTitle: function() {
    return this.changeTitle( this.sumDays(1,7), this.sumDays(8,14), 'two weeks ago');
  }.property('data'),

  thirtyDayCountTitle: function() {
    return this.changeTitle( this.sumDays(1,30), this.get('prev30Days'), 'in the previous 30 day period');
  }.property('data'),

  dataReversed: function() {
    return this.get('data').toArray().reverse();
  }.property('data')

});

Discourse.Report.reopenClass({
  find: function(type) {
    var model = Discourse.Report.create({type: type});
    Discourse.ajax("/admin/reports/" + type).then(function (json) {
      // Add a percent field to each tuple
      var maxY = 0;
      json.report.data.forEach(function (row) {
        if (row.y > maxY) maxY = row.y;
      });
      if (maxY > 0) {
        json.report.data.forEach(function (row) {
          row.percentage = Math.round((row.y / maxY) * 100);
        });
      }
      model.setProperties(json.report);
      model.set('loaded', true);
    });
    return(model);
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/report.js'] = "Discourse.Report = Discourse.Model.extend({\n  reportUrl: function() {\n    return(\"/admin/reports/\" + this.get('type'));\n  }.property('type'),\n\n  valueAt: function(numDaysAgo) {\n    if (this.data) {\n      var wantedDate = moment().subtract(numDaysAgo, 'days').format('YYYY-MM-DD');\n      var item = this.data.find( function(d) { return d.x === wantedDate; } );\n      if (item) {\n        return item.y;\n      }\n    }\n    return 0;\n  },\n\n  sumDays: function(startDaysAgo, endDaysAgo) {\n    if (this.data) {\n      var earliestDate = moment().subtract(endDaysAgo, 'days').startOf('day');\n      var latestDate = moment().subtract(startDaysAgo, 'days').startOf('day');\n      var d, sum = 0;\n      _.each(this.data,function(datum){\n        d = moment(datum.x);\n        if(d \u003e= earliestDate \u0026\u0026 d \u003c= latestDate) {\n          sum += datum.y;\n        }\n      });\n      return sum;\n    }\n  },\n\n  todayCount: function() {\n    return this.valueAt(0);\n  }.property('data'),\n\n  yesterdayCount: function() {\n    return this.valueAt(1);\n  }.property('data'),\n\n  lastSevenDaysCount: function() {\n    return this.sumDays(1,7);\n  }.property('data'),\n\n  lastThirtyDaysCount: function() {\n    return this.sumDays(1,30);\n  }.property('data'),\n\n  sevenDaysAgoCount: function() {\n    return this.valueAt(7);\n  }.property('data'),\n\n  thirtyDaysAgoCount: function() {\n    return this.valueAt(30);\n  }.property('data'),\n\n  yesterdayTrend: function() {\n    var yesterdayVal = this.valueAt(1);\n    var twoDaysAgoVal = this.valueAt(2);\n    if ( yesterdayVal \u003e twoDaysAgoVal ) {\n      return 'trending-up';\n    } else if ( yesterdayVal \u003c twoDaysAgoVal ) {\n      return 'trending-down';\n    } else {\n      return 'no-change';\n    }\n  }.property('data'),\n\n  sevenDayTrend: function() {\n    var currentPeriod = this.sumDays(1,7);\n    var prevPeriod = this.sumDays(8,14);\n    if ( currentPeriod \u003e prevPeriod ) {\n      return 'trending-up';\n    } else if ( currentPeriod \u003c prevPeriod ) {\n      return 'trending-down';\n    } else {\n      return 'no-change';\n    }\n  }.property('data'),\n\n  thirtyDayTrend: function() {\n    if( this.get('prev30Days') ) {\n      var currentPeriod = this.sumDays(1,30);\n      if( currentPeriod \u003e this.get('prev30Days') ) {\n        return 'trending-up';\n      } else if ( currentPeriod \u003c this.get('prev30Days') ) {\n        return 'trending-down';\n      }\n    }\n    return 'no-change';\n  }.property('data', 'prev30Days'),\n\n  icon: function() {\n    switch( this.get('type') ) {\n    case 'flags':\n      return 'fa-flag';\n    case 'likes':\n      return 'fa-heart';\n    default:\n      return null;\n    }\n  }.property('type'),\n\n  percentChangeString: function(val1, val2) {\n    var val = ((val1 - val2) / val2) * 100;\n    if( isNaN(val) || !isFinite(val) ) {\n      return null;\n    } else if( val \u003e 0 ) {\n      return '+' + val.toFixed(0) + '%';\n    } else {\n      return val.toFixed(0) + '%';\n    }\n  },\n\n  changeTitle: function(val1, val2, prevPeriodString) {\n    var title = '';\n    var percentChange = this.percentChangeString(val1, val2);\n    if( percentChange ) {\n      title += percentChange + ' change. ';\n    }\n    title += 'Was ' + val2 + ' ' + prevPeriodString + '.';\n    return title;\n  },\n\n  yesterdayCountTitle: function() {\n    return this.changeTitle( this.valueAt(1), this.valueAt(2),'two days ago');\n  }.property('data'),\n\n  sevenDayCountTitle: function() {\n    return this.changeTitle( this.sumDays(1,7), this.sumDays(8,14), 'two weeks ago');\n  }.property('data'),\n\n  thirtyDayCountTitle: function() {\n    return this.changeTitle( this.sumDays(1,30), this.get('prev30Days'), 'in the previous 30 day period');\n  }.property('data'),\n\n  dataReversed: function() {\n    return this.get('data').toArray().reverse();\n  }.property('data')\n\n});\n\nDiscourse.Report.reopenClass({\n  find: function(type) {\n    var model = Discourse.Report.create({type: type});\n    Discourse.ajax(\"/admin/reports/\" + type).then(function (json) {\n      // Add a percent field to each tuple\n      var maxY = 0;\n      json.report.data.forEach(function (row) {\n        if (row.y \u003e maxY) maxY = row.y;\n      });\n      if (maxY \u003e 0) {\n        json.report.data.forEach(function (row) {\n          row.percentage = Math.round((row.y / maxY) * 100);\n        });\n      }\n      model.setProperties(json.report);\n      model.set('loaded', true);\n    });\n    return(model);\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an email address that is watched for during account registration,
  and an action is taken.

  @class ScreenedEmail
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedEmail = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_actions." + this.get('action'));
  }.property('action'),

  clearBlock: function() {
    return Discourse.ajax('/admin/logs/screened_emails/' + this.get('id'), {method: 'DELETE'});
  }
});

Discourse.ScreenedEmail.reopenClass({
  findAll: function() {
    return Discourse.ajax("/admin/logs/screened_emails.json").then(function(screened_emails) {
      return screened_emails.map(function(b) {
        return Discourse.ScreenedEmail.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/screened_email.js'] = "/**\n  Represents an email address that is watched for during account registration,\n  and an action is taken.\n\n  @class ScreenedEmail\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ScreenedEmail = Discourse.Model.extend({\n  actionName: function() {\n    return I18n.t(\"admin.logs.screened_actions.\" + this.get('action'));\n  }.property('action'),\n\n  clearBlock: function() {\n    return Discourse.ajax('/admin/logs/screened_emails/' + this.get('id'), {method: 'DELETE'});\n  }\n});\n\nDiscourse.ScreenedEmail.reopenClass({\n  findAll: function() {\n    return Discourse.ajax(\"/admin/logs/screened_emails.json\").then(function(screened_emails) {\n      return screened_emails.map(function(b) {\n        return Discourse.ScreenedEmail.create(b);\n      });\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an IP address that is watched for during account registration
  (and possibly other times), and an action is taken.

  @class ScreenedIpAddress
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedIpAddress = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_ips.actions." + this.get('action_name'));
  }.property('action_name'),

  isBlocked: function() {
    return (this.get('action_name') === 'block');
  }.property('action_name'),

  actionIcon: function() {
    if (this.get('action_name') === 'block') {
      return this.get('blockIcon');
    } else {
      return this.get('doNothingIcon');
    }
  }.property('action_name'),

  blockIcon: function() {
    return 'fa-ban';
  }.property(),

  doNothingIcon: function() {
    return 'fa-check';
  }.property(),

  save: function() {
    return Discourse.ajax("/admin/logs/screened_ip_addresses" + (this.id ? '/' + this.id : '') + ".json", {
      type: this.id ? 'PUT' : 'POST',
      data: {ip_address: this.get('ip_address'), action_name: this.get('action_name')}
    });
  },

  destroy: function() {
    return Discourse.ajax("/admin/logs/screened_ip_addresses/" + this.get('id') + ".json", {type: 'DELETE'});
  }
});

Discourse.ScreenedIpAddress.reopenClass({
  findAll: function() {
    return Discourse.ajax("/admin/logs/screened_ip_addresses.json").then(function(screened_ips) {
      return screened_ips.map(function(b) {
        return Discourse.ScreenedIpAddress.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/screened_ip_address.js'] = "/**\n  Represents an IP address that is watched for during account registration\n  (and possibly other times), and an action is taken.\n\n  @class ScreenedIpAddress\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ScreenedIpAddress = Discourse.Model.extend({\n  actionName: function() {\n    return I18n.t(\"admin.logs.screened_ips.actions.\" + this.get('action_name'));\n  }.property('action_name'),\n\n  isBlocked: function() {\n    return (this.get('action_name') === 'block');\n  }.property('action_name'),\n\n  actionIcon: function() {\n    if (this.get('action_name') === 'block') {\n      return this.get('blockIcon');\n    } else {\n      return this.get('doNothingIcon');\n    }\n  }.property('action_name'),\n\n  blockIcon: function() {\n    return 'fa-ban';\n  }.property(),\n\n  doNothingIcon: function() {\n    return 'fa-check';\n  }.property(),\n\n  save: function() {\n    return Discourse.ajax(\"/admin/logs/screened_ip_addresses\" + (this.id ? '/' + this.id : '') + \".json\", {\n      type: this.id ? 'PUT' : 'POST',\n      data: {ip_address: this.get('ip_address'), action_name: this.get('action_name')}\n    });\n  },\n\n  destroy: function() {\n    return Discourse.ajax(\"/admin/logs/screened_ip_addresses/\" + this.get('id') + \".json\", {type: 'DELETE'});\n  }\n});\n\nDiscourse.ScreenedIpAddress.reopenClass({\n  findAll: function() {\n    return Discourse.ajax(\"/admin/logs/screened_ip_addresses.json\").then(function(screened_ips) {\n      return screened_ips.map(function(b) {\n        return Discourse.ScreenedIpAddress.create(b);\n      });\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents a URL that is watched for, and an action may be taken.

  @class ScreenedUrl
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedUrl = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_actions." + this.get('action'));
  }.property('action')
});

Discourse.ScreenedUrl.reopenClass({
  findAll: function() {
    return Discourse.ajax("/admin/logs/screened_urls.json").then(function(screened_urls) {
      return screened_urls.map(function(b) {
        return Discourse.ScreenedUrl.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/screened_url.js'] = "/**\n  Represents a URL that is watched for, and an action may be taken.\n\n  @class ScreenedUrl\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ScreenedUrl = Discourse.Model.extend({\n  actionName: function() {\n    return I18n.t(\"admin.logs.screened_actions.\" + this.get('action'));\n  }.property('action')\n});\n\nDiscourse.ScreenedUrl.reopenClass({\n  findAll: function() {\n    return Discourse.ajax(\"/admin/logs/screened_urls.json\").then(function(screened_urls) {\n      return screened_urls.map(function(b) {\n        return Discourse.ScreenedUrl.create(b);\n      });\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with custom site content

  @class SiteContent
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteContent = Discourse.Model.extend({

  markdown: Em.computed.equal('format', 'markdown'),
  plainText: Em.computed.equal('format', 'plain'),
  html: Em.computed.equal('format', 'html'),
  css: Em.computed.equal('format', 'css'),

  /**
    Save the content

    @method save
    @return {jqXHR} a jQuery Promise object
  **/
  save: function() {
    return Discourse.ajax("/admin/site_contents/" + this.get('content_type'), {
      type: 'PUT',
      data: {content: this.get('content')}
    });
  }

});

Discourse.SiteContent.reopenClass({

  find: function(type) {
    return Discourse.ajax("/admin/site_contents/" + type).then(function (data) {
      return Discourse.SiteContent.create(data.site_content);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/site_content.js'] = "/**\n  Our data model for interacting with custom site content\n\n  @class SiteContent\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.SiteContent = Discourse.Model.extend({\n\n  markdown: Em.computed.equal('format', 'markdown'),\n  plainText: Em.computed.equal('format', 'plain'),\n  html: Em.computed.equal('format', 'html'),\n  css: Em.computed.equal('format', 'css'),\n\n  /**\n    Save the content\n\n    @method save\n    @return {jqXHR} a jQuery Promise object\n  **/\n  save: function() {\n    return Discourse.ajax(\"/admin/site_contents/\" + this.get('content_type'), {\n      type: 'PUT',\n      data: {content: this.get('content')}\n    });\n  }\n\n});\n\nDiscourse.SiteContent.reopenClass({\n\n  find: function(type) {\n    return Discourse.ajax(\"/admin/site_contents/\" + type).then(function (data) {\n      return Discourse.SiteContent.create(data.site_content);\n    });\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model that represents types of editing site content

  @class SiteContentType
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteContentType = Discourse.Model.extend({});

Discourse.SiteContentType.reopenClass({
  findAll: function() {
    return Discourse.ajax("/admin/site_content_types").then(function(data) {
      var contentTypes = Em.A();
      data.forEach(function (ct) {
        contentTypes.pushObject(Discourse.SiteContentType.create(ct));
      });
      return contentTypes;
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/site_content_type.js'] = "/**\n  Our data model that represents types of editing site content\n\n  @class SiteContentType\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.SiteContentType = Discourse.Model.extend({});\n\nDiscourse.SiteContentType.reopenClass({\n  findAll: function() {\n    return Discourse.ajax(\"/admin/site_content_types\").then(function(data) {\n      var contentTypes = Em.A();\n      data.forEach(function (ct) {\n        contentTypes.pushObject(Discourse.SiteContentType.create(ct));\n      });\n      return contentTypes;\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with site customizations.

  @class SiteCustomization
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteCustomization = Discourse.Model.extend({
  trackedProperties: ['enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'override_default_style'],

  init: function() {
    this._super();
    this.startTrackingChanges();
  },

  description: function() {
    return "" + this.name + (this.enabled ? ' (*)' : '');
  }.property('selected', 'name'),

  changed: function() {

    var _this = this;
    if(!this.originals) return false;

    var changed = _.some(this.trackedProperties,function(p) {
      return _this.originals[p] !== _this.get(p);
    });

    if(changed){
      this.set('savingStatus','');
    }

    return changed;

  }.property('override_default_style', 'enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'originals'),

  startTrackingChanges: function() {
    var _this = this;
    var originals = {};
    _.each(this.trackedProperties,function(prop) {
      originals[prop] = _this.get(prop);
      return true;
    });
    this.set('originals', originals);
  },

  previewUrl: function() {
    return "/?preview-style=" + (this.get('key'));
  }.property('key'),

  disableSave: function() {
    return !this.get('changed') || this.get('saving');
  }.property('changed'),


  save: function() {
    this.set('savingStatus', I18n.t('saving'));
    this.set('saving',true);
    var data = {
      name: this.name,
      enabled: this.enabled,
      stylesheet: this.stylesheet,
      header: this.header,
      mobile_stylesheet: this.mobile_stylesheet,
      mobile_header: this.mobile_header,
      override_default_style: this.override_default_style
    };

    var siteCustomization = this;
    return Discourse.ajax("/admin/site_customizations" + (this.id ? '/' + this.id : ''), {
      data: { site_customization: data },
      type: this.id ? 'PUT' : 'POST'
    }).then(function (result) {
      if (!siteCustomization.id) {
        siteCustomization.set('id', result.id);
        siteCustomization.set('key', result.key);
      }
      siteCustomization.set('savingStatus', I18n.t('saved'));
      siteCustomization.set('saving',false);
      siteCustomization.startTrackingChanges();
    });

  },

  destroy: function() {
    if(!this.id) return;
    return Discourse.ajax("/admin/site_customizations/" + this.id, {
      type: 'DELETE'
    });
  }

});

var SiteCustomizations = Ember.ArrayProxy.extend({
  selectedItemChanged: function() {
    var selected = this.get('selectedItem');
    _.each(this.get('content'),function(i) {
      return i.set('selected', selected === i);
    });
  }.observes('selectedItem')
});

Discourse.SiteCustomization.reopenClass({
  findAll: function() {
    var customizations = SiteCustomizations.create({ content: [], loading: true });
    Discourse.ajax("/admin/site_customizations").then(function (data) {
      if (data) {
        _.each(data.site_customizations,function(c) {
          customizations.pushObject(Discourse.SiteCustomization.create(c.site_customizations));
        });
      }
      customizations.set('loading', false);
    });
    return customizations;
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/site_customization.js'] = "/**\n  Our data model for interacting with site customizations.\n\n  @class SiteCustomization\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.SiteCustomization = Discourse.Model.extend({\n  trackedProperties: ['enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'override_default_style'],\n\n  init: function() {\n    this._super();\n    this.startTrackingChanges();\n  },\n\n  description: function() {\n    return \"\" + this.name + (this.enabled ? ' (*)' : '');\n  }.property('selected', 'name'),\n\n  changed: function() {\n\n    var _this = this;\n    if(!this.originals) return false;\n\n    var changed = _.some(this.trackedProperties,function(p) {\n      return _this.originals[p] !== _this.get(p);\n    });\n\n    if(changed){\n      this.set('savingStatus','');\n    }\n\n    return changed;\n\n  }.property('override_default_style', 'enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'originals'),\n\n  startTrackingChanges: function() {\n    var _this = this;\n    var originals = {};\n    _.each(this.trackedProperties,function(prop) {\n      originals[prop] = _this.get(prop);\n      return true;\n    });\n    this.set('originals', originals);\n  },\n\n  previewUrl: function() {\n    return \"/?preview-style=\" + (this.get('key'));\n  }.property('key'),\n\n  disableSave: function() {\n    return !this.get('changed') || this.get('saving');\n  }.property('changed'),\n\n\n  save: function() {\n    this.set('savingStatus', I18n.t('saving'));\n    this.set('saving',true);\n    var data = {\n      name: this.name,\n      enabled: this.enabled,\n      stylesheet: this.stylesheet,\n      header: this.header,\n      mobile_stylesheet: this.mobile_stylesheet,\n      mobile_header: this.mobile_header,\n      override_default_style: this.override_default_style\n    };\n\n    var siteCustomization = this;\n    return Discourse.ajax(\"/admin/site_customizations\" + (this.id ? '/' + this.id : ''), {\n      data: { site_customization: data },\n      type: this.id ? 'PUT' : 'POST'\n    }).then(function (result) {\n      if (!siteCustomization.id) {\n        siteCustomization.set('id', result.id);\n        siteCustomization.set('key', result.key);\n      }\n      siteCustomization.set('savingStatus', I18n.t('saved'));\n      siteCustomization.set('saving',false);\n      siteCustomization.startTrackingChanges();\n    });\n\n  },\n\n  destroy: function() {\n    if(!this.id) return;\n    return Discourse.ajax(\"/admin/site_customizations/\" + this.id, {\n      type: 'DELETE'\n    });\n  }\n\n});\n\nvar SiteCustomizations = Ember.ArrayProxy.extend({\n  selectedItemChanged: function() {\n    var selected = this.get('selectedItem');\n    _.each(this.get('content'),function(i) {\n      return i.set('selected', selected === i);\n    });\n  }.observes('selectedItem')\n});\n\nDiscourse.SiteCustomization.reopenClass({\n  findAll: function() {\n    var customizations = SiteCustomizations.create({ content: [], loading: true });\n    Discourse.ajax(\"/admin/site_customizations\").then(function (data) {\n      if (data) {\n        _.each(data.site_customizations,function(c) {\n          customizations.pushObject(Discourse.SiteCustomization.create(c.site_customizations));\n        });\n      }\n      customizations.set('loading', false);\n    });\n    return customizations;\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with site settings.

  @class SiteSetting
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteSetting = Discourse.Model.extend({

  validationMessage: null,

  /**
    Is the boolean setting true?

    @property enabled
  **/
  enabled: function(key, value) {

    if (arguments.length === 1) {
      // get the boolean value of the setting
      if (this.blank('value')) return false;
      return this.get('value') === 'true';

    } else {
      // set the boolean value of the setting
      this.set('value', value ? 'true' : 'false');
    }

  }.property('value'),

  /**
    The name of the setting. Basically, underscores in the setting key are replaced with spaces.

    @property settingName
  **/
  settingName: function() {
    return this.get('setting').replace(/\_/g, ' ');
  }.property('setting'),

  /**
    Has the user changed the setting? If so we should save it.

    @property dirty
  **/
  dirty: function() {
    return this.get('originalValue') !== this.get('value');
  }.property('originalValue', 'value'),

  overridden: function() {
    var val = this.get('value'),
        defaultVal = this.get('default');

    if (val === null) val = '';
    if (defaultVal === null) defaultVal = '';

    return val.toString() !== defaultVal.toString();
  }.property('value', 'default'),

  /**
    Reset the setting to its original value.

    @method resetValue
  **/
  resetValue: function() {
    this.set('value', this.get('originalValue'));
    this.set('validationMessage', null);
  },

  /**
    Save the setting's value.

    @method save
  **/
  save: function() {
    // Update the setting
    var self = this, data = {};
    data[this.get('setting')] = this.get('value');
    return Discourse.ajax("/admin/site_settings/" + this.get('setting'), {
      data: data,
      type: 'PUT'
    }).then(function() {
      self.set('originalValue', self.get('value'));
      self.set('validationMessage', null);
    }, function(e) {
      if (e.responseJSON && e.responseJSON.errors) {
        self.set('validationMessage', e.responseJSON.errors[0]);
      } else {
        self.set('validationMessage', I18n.t('generic_error'));
      }
    });
  },

  validValues: function() {
    var vals, setting;
    vals = Em.A();
    setting = this;
    _.each(this.get('valid_values'), function(v) {
      if (v.name && v.name.length > 0) {
        if (setting.translate_names) {
          vals.addObject({name: I18n.t(v.name), value: v.value});
        } else {
          vals.addObject(v);
        }
      }
    });
    return vals;
  }.property('valid_values'),

  allowsNone: function() {
    if ( _.indexOf(this.get('valid_values'), '') >= 0 ) return 'admin.site_settings.none';
  }.property('valid_values')
});

Discourse.SiteSetting.reopenClass({

  findAll: function() {
    return Discourse.ajax("/admin/site_settings").then(function (settings) {
      // Group the results by category
      var categoryNames = [],
          categories = {},
          result = Em.A();
      _.each(settings.site_settings,function(s) {
        s.originalValue = s.value;
        if (!categoryNames.contains(s.category)) {
          categoryNames.pushObject(s.category);
          categories[s.category] = Em.A();
        }
        categories[s.category].pushObject(Discourse.SiteSetting.create(s));
      });
      _.each(categoryNames, function(n) {
        result.pushObject({nameKey: n, name: I18n.t('admin.site_settings.categories.' + n), siteSettings: categories[n]});
      });
      return result;
    });
  },

  update: function(key, value) {
    return Discourse.ajax("/admin/site_settings/" + key, {
      type: 'PUT',
      data: { value: value }
    });
  }

});




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/site_setting.js'] = "/**\n  Our data model for interacting with site settings.\n\n  @class SiteSetting\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.SiteSetting = Discourse.Model.extend({\n\n  validationMessage: null,\n\n  /**\n    Is the boolean setting true?\n\n    @property enabled\n  **/\n  enabled: function(key, value) {\n\n    if (arguments.length === 1) {\n      // get the boolean value of the setting\n      if (this.blank('value')) return false;\n      return this.get('value') === 'true';\n\n    } else {\n      // set the boolean value of the setting\n      this.set('value', value ? 'true' : 'false');\n    }\n\n  }.property('value'),\n\n  /**\n    The name of the setting. Basically, underscores in the setting key are replaced with spaces.\n\n    @property settingName\n  **/\n  settingName: function() {\n    return this.get('setting').replace(/\\_/g, ' ');\n  }.property('setting'),\n\n  /**\n    Has the user changed the setting? If so we should save it.\n\n    @property dirty\n  **/\n  dirty: function() {\n    return this.get('originalValue') !== this.get('value');\n  }.property('originalValue', 'value'),\n\n  overridden: function() {\n    var val = this.get('value'),\n        defaultVal = this.get('default');\n\n    if (val === null) val = '';\n    if (defaultVal === null) defaultVal = '';\n\n    return val.toString() !== defaultVal.toString();\n  }.property('value', 'default'),\n\n  /**\n    Reset the setting to its original value.\n\n    @method resetValue\n  **/\n  resetValue: function() {\n    this.set('value', this.get('originalValue'));\n    this.set('validationMessage', null);\n  },\n\n  /**\n    Save the setting's value.\n\n    @method save\n  **/\n  save: function() {\n    // Update the setting\n    var self = this, data = {};\n    data[this.get('setting')] = this.get('value');\n    return Discourse.ajax(\"/admin/site_settings/\" + this.get('setting'), {\n      data: data,\n      type: 'PUT'\n    }).then(function() {\n      self.set('originalValue', self.get('value'));\n      self.set('validationMessage', null);\n    }, function(e) {\n      if (e.responseJSON \u0026\u0026 e.responseJSON.errors) {\n        self.set('validationMessage', e.responseJSON.errors[0]);\n      } else {\n        self.set('validationMessage', I18n.t('generic_error'));\n      }\n    });\n  },\n\n  validValues: function() {\n    var vals, setting;\n    vals = Em.A();\n    setting = this;\n    _.each(this.get('valid_values'), function(v) {\n      if (v.name \u0026\u0026 v.name.length \u003e 0) {\n        if (setting.translate_names) {\n          vals.addObject({name: I18n.t(v.name), value: v.value});\n        } else {\n          vals.addObject(v);\n        }\n      }\n    });\n    return vals;\n  }.property('valid_values'),\n\n  allowsNone: function() {\n    if ( _.indexOf(this.get('valid_values'), '') \u003e= 0 ) return 'admin.site_settings.none';\n  }.property('valid_values')\n});\n\nDiscourse.SiteSetting.reopenClass({\n\n  findAll: function() {\n    return Discourse.ajax(\"/admin/site_settings\").then(function (settings) {\n      // Group the results by category\n      var categoryNames = [],\n          categories = {},\n          result = Em.A();\n      _.each(settings.site_settings,function(s) {\n        s.originalValue = s.value;\n        if (!categoryNames.contains(s.category)) {\n          categoryNames.pushObject(s.category);\n          categories[s.category] = Em.A();\n        }\n        categories[s.category].pushObject(Discourse.SiteSetting.create(s));\n      });\n      _.each(categoryNames, function(n) {\n        result.pushObject({nameKey: n, name: I18n.t('admin.site_settings.categories.' + n), siteSettings: categories[n]});\n      });\n      return result;\n    });\n  },\n\n  update: function(key, value) {\n    return Discourse.ajax(\"/admin/site_settings/\" + key, {\n      type: 'PUT',\n      data: { value: value }\n    });\n  }\n\n});\n\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an action taken by a staff member that has been logged.

  @class StaffActionLog
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.StaffActionLog = Discourse.Model.extend({
  showFullDetails: false,

  actionName: function() {
    return I18n.t("admin.logs.staff_actions.actions." + this.get('action_name'));
  }.property('action_name'),

  formattedDetails: function() {
    var formatted = "";
    formatted += this.format('email', 'email');
    formatted += this.format('admin.logs.ip_address', 'ip_address');
    if (!this.get('useCustomModalForDetails')) {
      formatted += this.format('admin.logs.staff_actions.new_value', 'new_value');
      formatted += this.format('admin.logs.staff_actions.previous_value', 'previous_value');
    }
    if (!this.get('useModalForDetails')) {
      if (this.get('details')) formatted += this.get('details') + '<br/>';
    }
    return formatted;
  }.property('ip_address', 'email'),

  format: function(label, propertyName) {
    if (this.get(propertyName)) {
      return ('<b>' + I18n.t(label) + ':</b> ' + this.get(propertyName) + '<br/>');
    } else {
      return '';
    }
  },

  useModalForDetails: function() {
    return (this.get('details') && this.get('details').length > 100);
  }.property('action_name'),

  useCustomModalForDetails: function() {
    return _.contains(['change_site_customization', 'delete_site_customization'], this.get('action_name'));
  }.property('action_name')
});

Discourse.StaffActionLog.reopenClass({
  create: function(attrs) {
    attrs = attrs || {};

    if (attrs.acting_user) {
      attrs.acting_user = Discourse.AdminUser.create(attrs.acting_user);
    }
    if (attrs.target_user) {
      attrs.target_user = Discourse.AdminUser.create(attrs.target_user);
    }
    return this._super(attrs);
  },

  findAll: function(filters) {
    return Discourse.ajax("/admin/logs/staff_action_logs.json", { data: filters }).then(function(staff_actions) {
      return staff_actions.map(function(s) {
        return Discourse.StaffActionLog.create(s);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/staff_action_log.js'] = "/**\n  Represents an action taken by a staff member that has been logged.\n\n  @class StaffActionLog\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.StaffActionLog = Discourse.Model.extend({\n  showFullDetails: false,\n\n  actionName: function() {\n    return I18n.t(\"admin.logs.staff_actions.actions.\" + this.get('action_name'));\n  }.property('action_name'),\n\n  formattedDetails: function() {\n    var formatted = \"\";\n    formatted += this.format('email', 'email');\n    formatted += this.format('admin.logs.ip_address', 'ip_address');\n    if (!this.get('useCustomModalForDetails')) {\n      formatted += this.format('admin.logs.staff_actions.new_value', 'new_value');\n      formatted += this.format('admin.logs.staff_actions.previous_value', 'previous_value');\n    }\n    if (!this.get('useModalForDetails')) {\n      if (this.get('details')) formatted += this.get('details') + '\u003cbr/\u003e';\n    }\n    return formatted;\n  }.property('ip_address', 'email'),\n\n  format: function(label, propertyName) {\n    if (this.get(propertyName)) {\n      return ('\u003cb\u003e' + I18n.t(label) + ':\u003c/b\u003e ' + this.get(propertyName) + '\u003cbr/\u003e');\n    } else {\n      return '';\n    }\n  },\n\n  useModalForDetails: function() {\n    return (this.get('details') \u0026\u0026 this.get('details').length \u003e 100);\n  }.property('action_name'),\n\n  useCustomModalForDetails: function() {\n    return _.contains(['change_site_customization', 'delete_site_customization'], this.get('action_name'));\n  }.property('action_name')\n});\n\nDiscourse.StaffActionLog.reopenClass({\n  create: function(attrs) {\n    attrs = attrs || {};\n\n    if (attrs.acting_user) {\n      attrs.acting_user = Discourse.AdminUser.create(attrs.acting_user);\n    }\n    if (attrs.target_user) {\n      attrs.target_user = Discourse.AdminUser.create(attrs.target_user);\n    }\n    return this._super(attrs);\n  },\n\n  findAll: function(filters) {\n    return Discourse.ajax(\"/admin/logs/staff_action_logs.json\", { data: filters }).then(function(staff_actions) {\n      return staff_actions.map(function(s) {\n        return Discourse.StaffActionLog.create(s);\n      });\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for determining whether there's a new version of Discourse

  @class VersionCheck
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.VersionCheck = Discourse.Model.extend({

  noCheckPerformed: function() {
    return this.get('updated_at') === null;
  }.property('updated_at'),

  dataIsOld: function() {
    return this.get('version_check_pending') || moment().diff(moment(this.get('updated_at')), 'hours') >= 48;
  }.property('updated_at'),

  staleData: function() {
    return ( this.get('dataIsOld') ||
             (this.get('installed_version') !== this.get('latest_version') && this.get('missing_versions_count') === 0) ||
             (this.get('installed_version') === this.get('latest_version') && this.get('missing_versions_count') !== 0) );
  }.property('dataIsOld', 'missing_versions_count', 'installed_version', 'latest_version'),

  upToDate: function() {
    return this.get('missing_versions_count') === 0 || this.get('missing_versions_count') === null;
  }.property('missing_versions_count'),

  behindByOneVersion: function() {
    return this.get('missing_versions_count') === 1;
  }.property('missing_versions_count'),

  gitLink: function() {
    return "https://github.com/discourse/discourse/tree/" + this.get('installed_sha');
  }.property('installed_sha'),

  shortSha: function() {
    return this.get('installed_sha').substr(0,10);
  }.property('installed_sha')
});

Discourse.VersionCheck.reopenClass({
  find: function() {
    return Discourse.ajax('/admin/version_check').then(function(json) {
      return Discourse.VersionCheck.create(json);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/models/version_check.js'] = "/**\n  Our data model for determining whether there's a new version of Discourse\n\n  @class VersionCheck\n  @extends Discourse.Model\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.VersionCheck = Discourse.Model.extend({\n\n  noCheckPerformed: function() {\n    return this.get('updated_at') === null;\n  }.property('updated_at'),\n\n  dataIsOld: function() {\n    return this.get('version_check_pending') || moment().diff(moment(this.get('updated_at')), 'hours') \u003e= 48;\n  }.property('updated_at'),\n\n  staleData: function() {\n    return ( this.get('dataIsOld') ||\n             (this.get('installed_version') !== this.get('latest_version') \u0026\u0026 this.get('missing_versions_count') === 0) ||\n             (this.get('installed_version') === this.get('latest_version') \u0026\u0026 this.get('missing_versions_count') !== 0) );\n  }.property('dataIsOld', 'missing_versions_count', 'installed_version', 'latest_version'),\n\n  upToDate: function() {\n    return this.get('missing_versions_count') === 0 || this.get('missing_versions_count') === null;\n  }.property('missing_versions_count'),\n\n  behindByOneVersion: function() {\n    return this.get('missing_versions_count') === 1;\n  }.property('missing_versions_count'),\n\n  gitLink: function() {\n    return \"https://github.com/discourse/discourse/tree/\" + this.get('installed_sha');\n  }.property('installed_sha'),\n\n  shortSha: function() {\n    return this.get('installed_sha').substr(0,10);\n  }.property('installed_sha')\n});\n\nDiscourse.VersionCheck.reopenClass({\n  find: function() {\n    return Discourse.ajax('/admin/version_check').then(function(json) {\n      return Discourse.VersionCheck.create(json);\n    });\n  }\n});\n";
define("admin/routes/admin-dashboard", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      Handles the default admin route

      @class AdminDashboardRoute
      @extends Discourse.Route
      @namespace Discourse
      @module Discourse
    **/


    __exports__["default"] = Discourse.Route.extend({

      setupController: function(c) {
        this.fetchDashboardData(c);
        this.fetchGithubCommits(c);
      },

      fetchDashboardData: function(c) {
        if( !c.get('dashboardFetchedAt') || moment().subtract(30, 'minutes').toDate() > c.get('dashboardFetchedAt') ) {
          c.set('dashboardFetchedAt', new Date());
          Discourse.AdminDashboard.find().then(function(d) {
            if( Discourse.SiteSettings.version_checks ){
              c.set('versionCheck', Discourse.VersionCheck.create(d.version_check));
            }
            _.each(d.reports,function(report){
              c.set(report.type, Discourse.Report.create(report));
            });

            var topReferrers = d.top_referrers;
            if (topReferrers && topReferrers.data) {
              d.top_referrers.data = topReferrers.data.map(function (user) {
                return Discourse.AdminUser.create(user);
              });
              c.set('top_referrers', topReferrers);
            }

            ['admins', 'moderators', 'blocked', 'suspended', 'top_traffic_sources', 'top_referred_topics', 'updated_at'].forEach(function(x) {
              c.set(x, d[x]);
            });

            c.set('loading', false);
          });
        }

        if( !c.get('problemsFetchedAt') || moment().subtract(c.problemsCheckMinutes, 'minutes').toDate() > c.get('problemsFetchedAt') ) {
          c.set('problemsFetchedAt', new Date());
          c.loadProblems();
        }
      },

      fetchGithubCommits: function(c) {
        if( !c.get('commitsCheckedAt') || moment().subtract(1, 'hour').toDate() > c.get('commitsCheckedAt') ) {
          c.set('commitsCheckedAt', new Date());
          c.set('githubCommits', Discourse.GithubCommit.findAll());
        }
      }
    });
  });

Discourse.AdminDashboardRoute = require('admin/routes/admin-dashboard').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin-dashboard.js'] = "define(\"admin/routes/admin-dashboard\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    /**\n      Handles the default admin route\n\n      @class AdminDashboardRoute\n      @extends Discourse.Route\n      @namespace Discourse\n      @module Discourse\n    **/\n\n\n    __exports__[\"default\"] = Discourse.Route.extend({\n\n      setupController: function(c) {\n        this.fetchDashboardData(c);\n        this.fetchGithubCommits(c);\n      },\n\n      fetchDashboardData: function(c) {\n        if( !c.get('dashboardFetchedAt') || moment().subtract(30, 'minutes').toDate() \u003e c.get('dashboardFetchedAt') ) {\n          c.set('dashboardFetchedAt', new Date());\n          Discourse.AdminDashboard.find().then(function(d) {\n            if( Discourse.SiteSettings.version_checks ){\n              c.set('versionCheck', Discourse.VersionCheck.create(d.version_check));\n            }\n            _.each(d.reports,function(report){\n              c.set(report.type, Discourse.Report.create(report));\n            });\n\n            var topReferrers = d.top_referrers;\n            if (topReferrers \u0026\u0026 topReferrers.data) {\n              d.top_referrers.data = topReferrers.data.map(function (user) {\n                return Discourse.AdminUser.create(user);\n              });\n              c.set('top_referrers', topReferrers);\n            }\n\n            ['admins', 'moderators', 'blocked', 'suspended', 'top_traffic_sources', 'top_referred_topics', 'updated_at'].forEach(function(x) {\n              c.set(x, d[x]);\n            });\n\n            c.set('loading', false);\n          });\n        }\n\n        if( !c.get('problemsFetchedAt') || moment().subtract(c.problemsCheckMinutes, 'minutes').toDate() \u003e c.get('problemsFetchedAt') ) {\n          c.set('problemsFetchedAt', new Date());\n          c.loadProblems();\n        }\n      },\n\n      fetchGithubCommits: function(c) {\n        if( !c.get('commitsCheckedAt') || moment().subtract(1, 'hour').toDate() \u003e c.get('commitsCheckedAt') ) {\n          c.set('commitsCheckedAt', new Date());\n          c.set('githubCommits', Discourse.GithubCommit.findAll());\n        }\n      }\n    });\n  });";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to api

  @class AdminApiRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminApiRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.ApiKey.find();
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_api_route.js'] = "/**\n  Handles routes related to api\n\n  @class AdminApiRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminApiRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.ApiKey.find();\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBackupsIndexRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.Backup.find();
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_backups_index_route.js'] = "Discourse.AdminBackupsIndexRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.Backup.find();\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBackupsLogsRoute = Discourse.Route.extend({

  // since the logs are pushed via the message bus
  // we only want to preload them (hence the beforeModel hook)
  beforeModel: function() {
    var logsController = this.controllerFor("adminBackupsLogs");
    // preload the logs if any
    PreloadStore.getAndRemove("logs").then(function (preloadedLogs) {
      if (preloadedLogs && preloadedLogs.length) {
        // we need to filter out message like: "[SUCCESS]"
        // and convert POJOs to Ember Objects
        var logs = _.chain(preloadedLogs)
                    .reject(function (log) { return log.message.length === 0 || log.message[0] === "["; })
                    .map(function (log) { return Em.Object.create(log); })
                    .value();
        logsController.pushObjects(logs);
      }
    });
  },

  setupController: function() { /* prevent default behavior */ }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_backups_logs_route.js'] = "Discourse.AdminBackupsLogsRoute = Discourse.Route.extend({\n\n  // since the logs are pushed via the message bus\n  // we only want to preload them (hence the beforeModel hook)\n  beforeModel: function() {\n    var logsController = this.controllerFor(\"adminBackupsLogs\");\n    // preload the logs if any\n    PreloadStore.getAndRemove(\"logs\").then(function (preloadedLogs) {\n      if (preloadedLogs \u0026\u0026 preloadedLogs.length) {\n        // we need to filter out message like: \"[SUCCESS]\"\n        // and convert POJOs to Ember Objects\n        var logs = _.chain(preloadedLogs)\n                    .reject(function (log) { return log.message.length === 0 || log.message[0] === \"[\"; })\n                    .map(function (log) { return Em.Object.create(log); })\n                    .value();\n        logsController.pushObjects(logs);\n      }\n    });\n  },\n\n  setupController: function() { /* prevent default behavior */ }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBackupsRoute = Discourse.Route.extend({

  LOG_CHANNEL: "/admin/backups/logs",

  activate: function() {
    Discourse.MessageBus.subscribe(this.LOG_CHANNEL, this._processLogMessage.bind(this));
  },

  _processLogMessage: function(log) {
    if (log.message === "[STARTED]") {
      this.controllerFor("adminBackups").set("isOperationRunning", true);
      this.controllerFor("adminBackupsLogs").clear();
    } else if (log.message === "[FAILED]") {
      this.controllerFor("adminBackups").set("isOperationRunning", false);
      bootbox.alert(I18n.t("admin.backups.operations.failed", { operation: log.operation }));
    } else if (log.message === "[SUCCESS]") {
      Discourse.User.currentProp("hideReadOnlyAlert", false);
      this.controllerFor("adminBackups").set("isOperationRunning", false);
      if (log.operation === "restore") {
        // redirect to homepage when the restore is done (session might be lost)
        window.location.pathname = Discourse.getURL("/");
      }
    } else {
      this.controllerFor("adminBackupsLogs").pushObject(Em.Object.create(log));
    }
  },

  model: function() {
    return PreloadStore.getAndRemove("operations_status", function() {
      return Discourse.ajax("/admin/backups/status.json");
    }).then(function (status) {
      return Discourse.BackupStatus.create({
        isOperationRunning: status.is_operation_running,
        canRollback: status.can_rollback,
        allowRestore: status.allow_restore
      });
    });
  },

  deactivate: function() {
    Discourse.MessageBus.unsubscribe(this.LOG_CHANNEL);
  },

  actions: {
    /**
      Starts a backup and redirect the user to the logs tab

      @method startBackup
    **/
    startBackup: function() {
      Discourse.Route.showModal(this, 'admin_start_backup');
      this.controllerFor('modal').set('modalClass', 'start-backup-modal');
    },

    backupStarted: function () {
      this.modelFor("adminBackups").set("isOperationRunning", true);
      this.transitionTo("admin.backups.logs");
      this.send("closeModal");
    },

    /**
      Destroys a backup

      @method destroyBackup
      @param {Discourse.Backup} backup the backup to destroy
    **/
    destroyBackup: function(backup) {
      var self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.destroy.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            backup.destroy().then(function() {
              self.controllerFor("adminBackupsIndex").removeObject(backup);
            });
          }
        }
      );
    },

    /**
      Start a restore and redirect the user to the logs tab

      @method startRestore
      @param {Discourse.Backup} backup the backup to restore
    **/
    startRestore: function(backup) {
      var self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.restore.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            Discourse.User.currentProp("hideReadOnlyAlert", true);
            backup.restore().then(function() {
              self.controllerFor("adminBackupsLogs").clear();
              self.modelFor("adminBackups").set("isOperationRunning", true);
              self.transitionTo("admin.backups.logs");
            });
          }
        }
      );
    },

    /**
      Cancels the current operation

      @method cancelOperation
    **/
    cancelOperation: function() {
      var self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.cancel.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            Discourse.Backup.cancel().then(function() {
              self.controllerFor("adminBackups").set("isOperationRunning", false);
            });
          }
        }
      );
    },

    /**
      Rollback to previous working state

      @method rollback
    **/
    rollback: function() {
      bootbox.confirm(
        I18n.t("admin.backups.operations.rollback.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) { Discourse.Backup.rollback(); }
        }
      );
    },

    uploadSuccess: function(filename) {
      var self = this;
      bootbox.alert(I18n.t("admin.backups.upload.success", { filename: filename }), function() {
        Discourse.Backup.find().then(function (backups) {
          self.controllerFor("adminBackupsIndex").set("model", backups);
        });
      });
    },

    uploadError: function(filename, message) {
      bootbox.alert(I18n.t("admin.backups.upload.error", { filename: filename, message: message }));
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_backups_route.js'] = "Discourse.AdminBackupsRoute = Discourse.Route.extend({\n\n  LOG_CHANNEL: \"/admin/backups/logs\",\n\n  activate: function() {\n    Discourse.MessageBus.subscribe(this.LOG_CHANNEL, this._processLogMessage.bind(this));\n  },\n\n  _processLogMessage: function(log) {\n    if (log.message === \"[STARTED]\") {\n      this.controllerFor(\"adminBackups\").set(\"isOperationRunning\", true);\n      this.controllerFor(\"adminBackupsLogs\").clear();\n    } else if (log.message === \"[FAILED]\") {\n      this.controllerFor(\"adminBackups\").set(\"isOperationRunning\", false);\n      bootbox.alert(I18n.t(\"admin.backups.operations.failed\", { operation: log.operation }));\n    } else if (log.message === \"[SUCCESS]\") {\n      Discourse.User.currentProp(\"hideReadOnlyAlert\", false);\n      this.controllerFor(\"adminBackups\").set(\"isOperationRunning\", false);\n      if (log.operation === \"restore\") {\n        // redirect to homepage when the restore is done (session might be lost)\n        window.location.pathname = Discourse.getURL(\"/\");\n      }\n    } else {\n      this.controllerFor(\"adminBackupsLogs\").pushObject(Em.Object.create(log));\n    }\n  },\n\n  model: function() {\n    return PreloadStore.getAndRemove(\"operations_status\", function() {\n      return Discourse.ajax(\"/admin/backups/status.json\");\n    }).then(function (status) {\n      return Discourse.BackupStatus.create({\n        isOperationRunning: status.is_operation_running,\n        canRollback: status.can_rollback,\n        allowRestore: status.allow_restore\n      });\n    });\n  },\n\n  deactivate: function() {\n    Discourse.MessageBus.unsubscribe(this.LOG_CHANNEL);\n  },\n\n  actions: {\n    /**\n      Starts a backup and redirect the user to the logs tab\n\n      @method startBackup\n    **/\n    startBackup: function() {\n      Discourse.Route.showModal(this, 'admin_start_backup');\n      this.controllerFor('modal').set('modalClass', 'start-backup-modal');\n    },\n\n    backupStarted: function () {\n      this.modelFor(\"adminBackups\").set(\"isOperationRunning\", true);\n      this.transitionTo(\"admin.backups.logs\");\n      this.send(\"closeModal\");\n    },\n\n    /**\n      Destroys a backup\n\n      @method destroyBackup\n      @param {Discourse.Backup} backup the backup to destroy\n    **/\n    destroyBackup: function(backup) {\n      var self = this;\n      bootbox.confirm(\n        I18n.t(\"admin.backups.operations.destroy.confirm\"),\n        I18n.t(\"no_value\"),\n        I18n.t(\"yes_value\"),\n        function(confirmed) {\n          if (confirmed) {\n            backup.destroy().then(function() {\n              self.controllerFor(\"adminBackupsIndex\").removeObject(backup);\n            });\n          }\n        }\n      );\n    },\n\n    /**\n      Start a restore and redirect the user to the logs tab\n\n      @method startRestore\n      @param {Discourse.Backup} backup the backup to restore\n    **/\n    startRestore: function(backup) {\n      var self = this;\n      bootbox.confirm(\n        I18n.t(\"admin.backups.operations.restore.confirm\"),\n        I18n.t(\"no_value\"),\n        I18n.t(\"yes_value\"),\n        function(confirmed) {\n          if (confirmed) {\n            Discourse.User.currentProp(\"hideReadOnlyAlert\", true);\n            backup.restore().then(function() {\n              self.controllerFor(\"adminBackupsLogs\").clear();\n              self.modelFor(\"adminBackups\").set(\"isOperationRunning\", true);\n              self.transitionTo(\"admin.backups.logs\");\n            });\n          }\n        }\n      );\n    },\n\n    /**\n      Cancels the current operation\n\n      @method cancelOperation\n    **/\n    cancelOperation: function() {\n      var self = this;\n      bootbox.confirm(\n        I18n.t(\"admin.backups.operations.cancel.confirm\"),\n        I18n.t(\"no_value\"),\n        I18n.t(\"yes_value\"),\n        function(confirmed) {\n          if (confirmed) {\n            Discourse.Backup.cancel().then(function() {\n              self.controllerFor(\"adminBackups\").set(\"isOperationRunning\", false);\n            });\n          }\n        }\n      );\n    },\n\n    /**\n      Rollback to previous working state\n\n      @method rollback\n    **/\n    rollback: function() {\n      bootbox.confirm(\n        I18n.t(\"admin.backups.operations.rollback.confirm\"),\n        I18n.t(\"no_value\"),\n        I18n.t(\"yes_value\"),\n        function(confirmed) {\n          if (confirmed) { Discourse.Backup.rollback(); }\n        }\n      );\n    },\n\n    uploadSuccess: function(filename) {\n      var self = this;\n      bootbox.alert(I18n.t(\"admin.backups.upload.success\", { filename: filename }), function() {\n        Discourse.Backup.find().then(function (backups) {\n          self.controllerFor(\"adminBackupsIndex\").set(\"model\", backups);\n        });\n      });\n    },\n\n    uploadError: function(filename, message) {\n      bootbox.alert(I18n.t(\"admin.backups.upload.error\", { filename: filename, message: message }));\n    }\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBadgesRoute = Discourse.Route.extend({
  setupController: function(controller) {
    Discourse.ajax('/admin/badges.json').then(function(json){

      controller.set('badgeGroupings', Em.A(json.badge_groupings));
      controller.set('badgeTypes', json.badge_types);
      controller.set('protectedSystemFields', json.admin_badges.protected_system_fields);
      var triggers = [];
      _.each(json.admin_badges.triggers,function(v,k){
        triggers.push({id: v, name: I18n.t('admin.badges.trigger_type.'+k)});
      });
      controller.set('badgeTriggers', triggers);
      controller.set('model', Discourse.Badge.createFromJson(json));
    });
  },

  actions: {
    editGroupings: function(model) {
      Discourse.Route.showModal(this, 'admin_edit_badge_groupings', model);
    },

    saveError: function(jqXhr) {
      if (jqXhr.status === 422) {
        Discourse.Route.showModal(this, 'admin_badge_preview', jqXhr.responseJSON);
      } else {
        Em.Logger.error(jqXhr);
        bootbox.alert(I18n.t('errors.description.unknown'));
      }
    },

    preview: function(badge, explain) {
      var self = this;

      badge.set('preview_loading', true);
      Discourse.ajax('/admin/badges/preview.json', {
        method: 'post',
        data: {
          sql: badge.query,
          target_posts: !!badge.target_posts,
          trigger: badge.trigger,
          explain: explain
        }
      }).then(function(json) {
        badge.set('preview_loading', false);
        Discourse.Route.showModal(self, 'admin_badge_preview', json);
      }).catch(function(error) {
        badge.set('preview_loading', false);
        Em.Logger.error(error);
        bootbox.alert("Network error");
      });
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_badges_route.js'] = "Discourse.AdminBadgesRoute = Discourse.Route.extend({\n  setupController: function(controller) {\n    Discourse.ajax('/admin/badges.json').then(function(json){\n\n      controller.set('badgeGroupings', Em.A(json.badge_groupings));\n      controller.set('badgeTypes', json.badge_types);\n      controller.set('protectedSystemFields', json.admin_badges.protected_system_fields);\n      var triggers = [];\n      _.each(json.admin_badges.triggers,function(v,k){\n        triggers.push({id: v, name: I18n.t('admin.badges.trigger_type.'+k)});\n      });\n      controller.set('badgeTriggers', triggers);\n      controller.set('model', Discourse.Badge.createFromJson(json));\n    });\n  },\n\n  actions: {\n    editGroupings: function(model) {\n      Discourse.Route.showModal(this, 'admin_edit_badge_groupings', model);\n    },\n\n    saveError: function(jqXhr) {\n      if (jqXhr.status === 422) {\n        Discourse.Route.showModal(this, 'admin_badge_preview', jqXhr.responseJSON);\n      } else {\n        Em.Logger.error(jqXhr);\n        bootbox.alert(I18n.t('errors.description.unknown'));\n      }\n    },\n\n    preview: function(badge, explain) {\n      var self = this;\n\n      badge.set('preview_loading', true);\n      Discourse.ajax('/admin/badges/preview.json', {\n        method: 'post',\n        data: {\n          sql: badge.query,\n          target_posts: !!badge.target_posts,\n          trigger: badge.trigger,\n          explain: explain\n        }\n      }).then(function(json) {\n        badge.set('preview_loading', false);\n        Discourse.Route.showModal(self, 'admin_badge_preview', json);\n      }).catch(function(error) {\n        badge.set('preview_loading', false);\n        Em.Logger.error(error);\n        bootbox.alert(\"Network error\");\n      });\n    }\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to colors customization

  @class AdminCustomizeColorsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeColorsRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.ColorScheme.findAll();
  },

  deactivate: function() {
    this._super();
    this.controllerFor('adminCustomizeColors').set('selectedItem', null);
  },

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_customize_colors_route.js'] = "/**\n  Handles routes related to colors customization\n\n  @class AdminCustomizeColorsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminCustomizeColorsRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.ColorScheme.findAll();\n  },\n\n  deactivate: function() {\n    this._super();\n    this.controllerFor('adminCustomizeColors').set('selectedItem', null);\n  },\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to css/html customization

  @class AdminCustomizeCssHtmlRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeCssHtmlRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.SiteCustomization.findAll();
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_customize_css_html_route.js'] = "/**\n  Handles routes related to css/html customization\n\n  @class AdminCustomizeCssHtmlRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminCustomizeCssHtmlRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.SiteCustomization.findAll();\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to customization

  @class AdminCustomizeIndexRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminCustomize.colors');
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_customize_route.js'] = "/**\n  Handles routes related to customization\n\n  @class AdminCustomizeIndexRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminCustomizeIndexRoute = Discourse.Route.extend({\n  redirect: function() {\n    this.transitionTo('adminCustomize.colors');\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles email routes

  @class AdminEmailRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailIndexRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.EmailSettings.find();
  },

  renderTemplate: function() {
    this.render('admin/templates/email_index', { into: 'adminEmail' });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_email_index_route.js'] = "/**\n  Handles email routes\n\n  @class AdminEmailRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminEmailIndexRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.EmailSettings.find();\n  },\n\n  renderTemplate: function() {\n    this.render('admin/templates/email_index', { into: 'adminEmail' });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing email logs.

  @class AdminEmailSentRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailLogsRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.EmailLog.findAll({ status: this.get("status") });
  },

  setupController: function(controller, model) {
    controller.set("model", model);
    // resets the filters
    controller.set("filter", { status: this.get("status") });
  },

  renderTemplate: function() {
    this.render("admin/templates/email_" + this.get("status"), { into: "adminEmail" });
  }

});

Discourse.AdminEmailAllRoute = Discourse.AdminEmailLogsRoute.extend({ status: "all" });
Discourse.AdminEmailSentRoute = Discourse.AdminEmailLogsRoute.extend({ status: "sent" });
Discourse.AdminEmailSkippedRoute = Discourse.AdminEmailLogsRoute.extend({ status: "skipped" });


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_email_logs_routes.js'] = "/**\n  Handles routes related to viewing email logs.\n\n  @class AdminEmailSentRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminEmailLogsRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.EmailLog.findAll({ status: this.get(\"status\") });\n  },\n\n  setupController: function(controller, model) {\n    controller.set(\"model\", model);\n    // resets the filters\n    controller.set(\"filter\", { status: this.get(\"status\") });\n  },\n\n  renderTemplate: function() {\n    this.render(\"admin/templates/email_\" + this.get(\"status\"), { into: \"adminEmail\" });\n  }\n\n});\n\nDiscourse.AdminEmailAllRoute = Discourse.AdminEmailLogsRoute.extend({ status: \"all\" });\nDiscourse.AdminEmailSentRoute = Discourse.AdminEmailLogsRoute.extend({ status: \"sent\" });\nDiscourse.AdminEmailSkippedRoute = Discourse.AdminEmailLogsRoute.extend({ status: \"skipped\" });\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Previews the Email Digests

  @class AdminEmailPreviewDigest
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/


Discourse.AdminEmailPreviewDigestRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.EmailPreview.findDigest();
  },

  afterModel: function(model) {
    var controller = this.controllerFor('adminEmailPreviewDigest');
    controller.setProperties({
      model: model,
      lastSeen: moment().subtract(7, 'days').format('YYYY-MM-DD'),
      showHtml: true
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_email_preview_digest_route.js'] = "/**\n  Previews the Email Digests\n\n  @class AdminEmailPreviewDigest\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\n\nDiscourse.AdminEmailPreviewDigestRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.EmailPreview.findDigest();\n  },\n\n  afterModel: function(model) {\n    var controller = this.controllerFor('adminEmailPreviewDigest');\n    controller.setProperties({\n      model: model,\n      lastSeen: moment().subtract(7, 'days').format('YYYY-MM-DD'),\n      showHtml: true\n    });\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminFlagsIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminFlags.active');
  }
});

Discourse.AdminFlagsRouteType = Discourse.Route.extend({
  model: function() {
    return Discourse.FlaggedPost.findAll(this.get('filter'));
  },

  setupController: function(controller, model) {
    var adminFlagsController = this.controllerFor('adminFlags');
    adminFlagsController.set('content', model);
    adminFlagsController.set('query', this.get('filter'));
  },

});

Discourse.AdminFlagsActiveRoute = Discourse.AdminFlagsRouteType.extend({
  filter: 'active',

  actions: {

    showAgreeFlagModal: function (flaggedPost) {
      Discourse.Route.showModal(this, 'admin_agree_flag', flaggedPost);
      this.controllerFor('modal').set('modalClass', 'agree-flag-modal');
    },

    showDeleteFlagModal: function (flaggedPost) {
      Discourse.Route.showModal(this, 'admin_delete_flag', flaggedPost);
      this.controllerFor('modal').set('modalClass', 'delete-flag-modal');
    }

  }
});


Discourse.AdminFlagsOldRoute = Discourse.AdminFlagsRouteType.extend({
  filter: 'old'
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_flags_route.js'] = "Discourse.AdminFlagsIndexRoute = Discourse.Route.extend({\n  redirect: function() {\n    this.transitionTo('adminFlags.active');\n  }\n});\n\nDiscourse.AdminFlagsRouteType = Discourse.Route.extend({\n  model: function() {\n    return Discourse.FlaggedPost.findAll(this.get('filter'));\n  },\n\n  setupController: function(controller, model) {\n    var adminFlagsController = this.controllerFor('adminFlags');\n    adminFlagsController.set('content', model);\n    adminFlagsController.set('query', this.get('filter'));\n  },\n\n});\n\nDiscourse.AdminFlagsActiveRoute = Discourse.AdminFlagsRouteType.extend({\n  filter: 'active',\n\n  actions: {\n\n    showAgreeFlagModal: function (flaggedPost) {\n      Discourse.Route.showModal(this, 'admin_agree_flag', flaggedPost);\n      this.controllerFor('modal').set('modalClass', 'agree-flag-modal');\n    },\n\n    showDeleteFlagModal: function (flaggedPost) {\n      Discourse.Route.showModal(this, 'admin_delete_flag', flaggedPost);\n      this.controllerFor('modal').set('modalClass', 'delete-flag-modal');\n    }\n\n  }\n});\n\n\nDiscourse.AdminFlagsOldRoute = Discourse.AdminFlagsRouteType.extend({\n  filter: 'old'\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminGroupRoute = Em.Route.extend({

  model: function(params) {
    var groups = this.modelFor('adminGroups'),
        group = groups.findProperty('name', params.name);

    if (!group) { return this.transitionTo('adminGroups.index'); }
    return group;
  },

  afterModel: function(model) {
    var self = this;
    return model.findMembers().then(function(members) {
      self.set('_members', members);
    });
  },

  setupController: function(controller, model) {
    controller.set('model', model);
    controller.set('members', this.get('_members'));
  }
});



// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_group_route.js'] = "Discourse.AdminGroupRoute = Em.Route.extend({\n\n  model: function(params) {\n    var groups = this.modelFor('adminGroups'),\n        group = groups.findProperty('name', params.name);\n\n    if (!group) { return this.transitionTo('adminGroups.index'); }\n    return group;\n  },\n\n  afterModel: function(model) {\n    var self = this;\n    return model.findMembers().then(function(members) {\n      self.set('_members', members);\n    });\n  },\n\n  setupController: function(controller, model) {\n    controller.set('model', model);\n    controller.set('members', this.get('_members'));\n  }\n});\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes for admin groups

  @class AdminGroupsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminGroupsRoute = Discourse.Route.extend({
  model: function() {
    return Discourse.Group.findAll();
  },

  actions: {
    showGroup: function(g) {
      // This hack is needed because the autocomplete plugin does not
      // refresh properly when the underlying data changes. TODO should
      // be to update the plugin so it works properly and remove this hack.
      var self = this;
      this.transitionTo('adminGroups.index').then(function() {
        self.transitionTo('adminGroup', g);
      });
    },

    newGroup: function(){
      var group = Discourse.Group.create({ visible: true });
      this.send('showGroup', group);
    }
  }
});



// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_groups_route.js'] = "/**\n  Handles routes for admin groups\n\n  @class AdminGroupsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminGroupsRoute = Discourse.Route.extend({\n  model: function() {\n    return Discourse.Group.findAll();\n  },\n\n  actions: {\n    showGroup: function(g) {\n      // This hack is needed because the autocomplete plugin does not\n      // refresh properly when the underlying data changes. TODO should\n      // be to update the plugin so it works properly and remove this hack.\n      var self = this;\n      this.transitionTo('adminGroups.index').then(function() {\n        self.transitionTo('adminGroup', g);\n      });\n    },\n\n    newGroup: function(){\n      var group = Discourse.Group.create({ visible: true });\n      this.send('showGroup', group);\n    }\n  }\n});\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Index redirects to a default logs index.

  @class AdminLogsIndexRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminLogs.staffActionLogs');
  }
});

/**
  The route that lists staff actions that were logged.

  @class AdminLogsStaffActionLogsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsStaffActionLogsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/staff_action_logs', {into: 'adminLogs'});
  },

  setupController: function(controller) {
    var queryParams = Discourse.URL.get('queryParams');
    if (queryParams) {
      controller.set('filters', queryParams);
    }
    return controller.show();
  },

  actions: {
    showDetailsModal: function(logRecord) {
      Discourse.Route.showModal(this, 'admin_staff_action_log_details', logRecord);
      this.controllerFor('modal').set('modalClass', 'log-details-modal');
    },

    showCustomDetailsModal: function(logRecord) {
      Discourse.Route.showModal(this, logRecord.action_name + '_details', logRecord);
      this.controllerFor('modal').set('modalClass', 'tabbed-modal log-details-modal');
    }
  },

  deactivate: function() {
    this._super();

    // Clear any filters when we leave the route
    Discourse.URL.set('queryParams', null);
  }
});

/**
  The route that lists blocked email addresses.

  @class AdminLogsScreenedEmailsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedEmailsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_emails', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedEmails').show();
  }
});

/**
  The route that lists screened IP addresses.

  @class AdminLogsScreenedIpAddresses
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedIpAddressesRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_ip_addresses', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedIpAddresses').show();
  }
});

/**
  The route that lists screened URLs.

  @class AdminLogsScreenedUrlsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedUrlsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_urls', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedUrls').show();
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_logs_routes.js'] = "/**\n  Index redirects to a default logs index.\n\n  @class AdminLogsIndexRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminLogsIndexRoute = Discourse.Route.extend({\n  redirect: function() {\n    this.transitionTo('adminLogs.staffActionLogs');\n  }\n});\n\n/**\n  The route that lists staff actions that were logged.\n\n  @class AdminLogsStaffActionLogsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminLogsStaffActionLogsRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/logs/staff_action_logs', {into: 'adminLogs'});\n  },\n\n  setupController: function(controller) {\n    var queryParams = Discourse.URL.get('queryParams');\n    if (queryParams) {\n      controller.set('filters', queryParams);\n    }\n    return controller.show();\n  },\n\n  actions: {\n    showDetailsModal: function(logRecord) {\n      Discourse.Route.showModal(this, 'admin_staff_action_log_details', logRecord);\n      this.controllerFor('modal').set('modalClass', 'log-details-modal');\n    },\n\n    showCustomDetailsModal: function(logRecord) {\n      Discourse.Route.showModal(this, logRecord.action_name + '_details', logRecord);\n      this.controllerFor('modal').set('modalClass', 'tabbed-modal log-details-modal');\n    }\n  },\n\n  deactivate: function() {\n    this._super();\n\n    // Clear any filters when we leave the route\n    Discourse.URL.set('queryParams', null);\n  }\n});\n\n/**\n  The route that lists blocked email addresses.\n\n  @class AdminLogsScreenedEmailsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminLogsScreenedEmailsRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/logs/screened_emails', {into: 'adminLogs'});\n  },\n\n  setupController: function() {\n    return this.controllerFor('adminLogsScreenedEmails').show();\n  }\n});\n\n/**\n  The route that lists screened IP addresses.\n\n  @class AdminLogsScreenedIpAddresses\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminLogsScreenedIpAddressesRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/logs/screened_ip_addresses', {into: 'adminLogs'});\n  },\n\n  setupController: function() {\n    return this.controllerFor('adminLogsScreenedIpAddresses').show();\n  }\n});\n\n/**\n  The route that lists screened URLs.\n\n  @class AdminLogsScreenedUrlsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminLogsScreenedUrlsRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/logs/screened_urls', {into: 'adminLogs'});\n  },\n\n  setupController: function() {\n    return this.controllerFor('adminLogsScreenedUrls').show();\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes for admin reports

  @class AdminReportsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminReportsRoute = Discourse.Route.extend({
  model: function(params) {
    return Discourse.Report.find(params.type);
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_reports_route.js'] = "/**\n  Handles routes for admin reports\n\n  @class AdminReportsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminReportsRoute = Discourse.Route.extend({\n  model: function(params) {\n    return Discourse.Report.find(params.type);\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The base admin route

  @class AdminRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/admin');
  },

  activate: function() {
    Discourse.set('title', I18n.t('admin_title'));
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_route.js'] = "/**\n  The base admin route\n\n  @class AdminRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/admin');\n  },\n\n  activate: function() {\n    Discourse.set('title', I18n.t('admin_title'));\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Builds the routes for the admin section

  @method buildRoutes
  @for Discourse.AdminRoute
**/

Discourse.Route.buildRoutes(function() {
  this.resource('admin', function() {
    this.route('dashboard', { path: '/' });
    this.resource('adminSiteSettings', { path: '/site_settings' }, function() {
      this.resource('adminSiteSettingsCategory', { path: 'category/:category_id'} );
    });

    this.resource('adminSiteContents', { path: '/site_contents' }, function() {
      this.resource('adminSiteContentEdit', {path: '/:content_type'});
    });

    this.resource('adminEmail', { path: '/email'}, function() {
      this.route('all');
      this.route('sent');
      this.route('skipped');
      this.route('previewDigest', { path: '/preview-digest' });
    });

    this.resource('adminCustomize', { path: '/customize' } ,function() {
      this.route('colors');
      this.route('css_html');
    });
    this.route('api');

    this.resource('admin.backups', { path: '/backups' }, function() {
      this.route('logs');
    });

    this.resource('adminReports', { path: '/reports/:type' });

    this.resource('adminFlags', { path: '/flags' }, function() {
      this.route('active');
      this.route('old');
    });

    this.resource('adminLogs', { path: '/logs' }, function() {
      this.route('staffActionLogs', { path: '/staff_action_logs' });
      this.route('screenedEmails', { path: '/screened_emails' });
      this.route('screenedIpAddresses', { path: '/screened_ip_addresses' });
      this.route('screenedUrls', { path: '/screened_urls' });
    });

    this.resource('adminGroups', { path: '/groups'}, function() {
      this.resource('adminGroup', { path: '/:name' });
    });

    this.resource('adminUsers', { path: '/users' }, function() {
      this.resource('adminUser', { path: '/:username' }, function() {
        this.route('badges');
        this.route('leaderRequirements', { path: '/leader_requirements' });
      });
      this.resource('adminUsersList', { path: '/list' }, function() {
        _.each(['active', 'new', 'pending', 'admins', 'moderators', 'blocked', 'suspended',
                'newuser', 'basicuser', 'regular', 'leaders', 'elders'], function(x) {
          this.route(x, { path: '/' + x });
        }, this);
      });
    });

    this.route('badges');

  });
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_routes.js'] = "/**\n  Builds the routes for the admin section\n\n  @method buildRoutes\n  @for Discourse.AdminRoute\n**/\n\nDiscourse.Route.buildRoutes(function() {\n  this.resource('admin', function() {\n    this.route('dashboard', { path: '/' });\n    this.resource('adminSiteSettings', { path: '/site_settings' }, function() {\n      this.resource('adminSiteSettingsCategory', { path: 'category/:category_id'} );\n    });\n\n    this.resource('adminSiteContents', { path: '/site_contents' }, function() {\n      this.resource('adminSiteContentEdit', {path: '/:content_type'});\n    });\n\n    this.resource('adminEmail', { path: '/email'}, function() {\n      this.route('all');\n      this.route('sent');\n      this.route('skipped');\n      this.route('previewDigest', { path: '/preview-digest' });\n    });\n\n    this.resource('adminCustomize', { path: '/customize' } ,function() {\n      this.route('colors');\n      this.route('css_html');\n    });\n    this.route('api');\n\n    this.resource('admin.backups', { path: '/backups' }, function() {\n      this.route('logs');\n    });\n\n    this.resource('adminReports', { path: '/reports/:type' });\n\n    this.resource('adminFlags', { path: '/flags' }, function() {\n      this.route('active');\n      this.route('old');\n    });\n\n    this.resource('adminLogs', { path: '/logs' }, function() {\n      this.route('staffActionLogs', { path: '/staff_action_logs' });\n      this.route('screenedEmails', { path: '/screened_emails' });\n      this.route('screenedIpAddresses', { path: '/screened_ip_addresses' });\n      this.route('screenedUrls', { path: '/screened_urls' });\n    });\n\n    this.resource('adminGroups', { path: '/groups'}, function() {\n      this.resource('adminGroup', { path: '/:name' });\n    });\n\n    this.resource('adminUsers', { path: '/users' }, function() {\n      this.resource('adminUser', { path: '/:username' }, function() {\n        this.route('badges');\n        this.route('leaderRequirements', { path: '/leader_requirements' });\n      });\n      this.resource('adminUsersList', { path: '/list' }, function() {\n        _.each(['active', 'new', 'pending', 'admins', 'moderators', 'blocked', 'suspended',\n                'newuser', 'basicuser', 'regular', 'leaders', 'elders'], function(x) {\n          this.route(x, { path: '/' + x });\n        }, this);\n      });\n    });\n\n    this.route('badges');\n\n  });\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Allows users to customize site content

  @class AdminSiteContentEditRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteContentEditRoute = Discourse.Route.extend({

  serialize: function(model) {
    return {content_type: model.get('content_type')};
  },

  model: function(params) {
    var list = Discourse.SiteContentType.findAll();

    return list.then(function(items) {
      return items.findProperty("content_type", params.content_type);
    });
  },

  renderTemplate: function() {
    this.render('admin/templates/site_content_edit', {into: 'admin/templates/site_contents'});
  },

  deactivate: function() {
    this._super();
    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});
  },

  setupController: function(controller, model) {

    controller.set('loaded', false);
    controller.setProperties({
      model: model,
      saving: false,
      saved: false
    });

    Discourse.SiteContent.find(model.get('content_type')).then(function (sc) {
      controller.set('content', sc);
      controller.set('loaded', true);
    });
  }


});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_site_content_edit_route.js'] = "/**\n  Allows users to customize site content\n\n  @class AdminSiteContentEditRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminSiteContentEditRoute = Discourse.Route.extend({\n\n  serialize: function(model) {\n    return {content_type: model.get('content_type')};\n  },\n\n  model: function(params) {\n    var list = Discourse.SiteContentType.findAll();\n\n    return list.then(function(items) {\n      return items.findProperty(\"content_type\", params.content_type);\n    });\n  },\n\n  renderTemplate: function() {\n    this.render('admin/templates/site_content_edit', {into: 'admin/templates/site_contents'});\n  },\n\n  deactivate: function() {\n    this._super();\n    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});\n  },\n\n  setupController: function(controller, model) {\n\n    controller.set('loaded', false);\n    controller.setProperties({\n      model: model,\n      saving: false,\n      saved: false\n    });\n\n    Discourse.SiteContent.find(model.get('content_type')).then(function (sc) {\n      controller.set('content', sc);\n      controller.set('loaded', true);\n    });\n  }\n\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Allows users to customize site content

  @class AdminSiteContentsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteContentsRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.SiteContentType.findAll();
  },

  renderTemplate: function() {
    this.render('admin/templates/site_contents', {into: 'admin/templates/admin'});
    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});
  },

  setupController: function(controller, model) {
    controller.set('model', model);
  }
});



// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_site_contents_route.js'] = "/**\n  Allows users to customize site content\n\n  @class AdminSiteContentsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminSiteContentsRoute = Discourse.Route.extend({\n\n  model: function() {\n    return Discourse.SiteContentType.findAll();\n  },\n\n  renderTemplate: function() {\n    this.render('admin/templates/site_contents', {into: 'admin/templates/admin'});\n    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});\n  },\n\n  setupController: function(controller, model) {\n    controller.set('model', model);\n  }\n});\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing and editing site settings within one category.

  @class AdminSiteSettingCategoryRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteSettingsCategoryRoute = Discourse.Route.extend({
  model: function(params) {
    // The model depends on user input, so let the controller do the work:
    this.controllerFor('adminSiteSettingsCategory').set('categoryNameKey', params.category_id);
    return Em.Object.create({
      nameKey: params.category_id,
      name: I18n.t('admin.site_settings.categories.' + params.category_id),
      siteSettings: this.controllerFor('adminSiteSettingsCategory').get('filteredContent')
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_site_settings_category_route.js'] = "/**\n  Handles routes related to viewing and editing site settings within one category.\n\n  @class AdminSiteSettingCategoryRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminSiteSettingsCategoryRoute = Discourse.Route.extend({\n  model: function(params) {\n    // The model depends on user input, so let the controller do the work:\n    this.controllerFor('adminSiteSettingsCategory').set('categoryNameKey', params.category_id);\n    return Em.Object.create({\n      nameKey: params.category_id,\n      name: I18n.t('admin.site_settings.categories.' + params.category_id),\n      siteSettings: this.controllerFor('adminSiteSettingsCategory').get('filteredContent')\n    });\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing and editing site settings.

  @class AdminSiteSettingsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteSettingsRoute = Discourse.Route.extend({
  model: function() {
    return Discourse.SiteSetting.findAll();
  },

  afterModel: function(siteSettings) {
    this.controllerFor('adminSiteSettings').set('allSiteSettings', siteSettings);
  }
});

/**
  Handles when you click the Site Settings tab in admin, but haven't
  chosen a category. It will redirect to the first category.
**/
Discourse.AdminSiteSettingsIndexRoute = Discourse.Route.extend({
  model: function() {
    this.replaceWith('adminSiteSettingsCategory', this.modelFor('adminSiteSettings')[0].nameKey);
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_site_settings_route.js'] = "/**\n  Handles routes related to viewing and editing site settings.\n\n  @class AdminSiteSettingsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminSiteSettingsRoute = Discourse.Route.extend({\n  model: function() {\n    return Discourse.SiteSetting.findAll();\n  },\n\n  afterModel: function(siteSettings) {\n    this.controllerFor('adminSiteSettings').set('allSiteSettings', siteSettings);\n  }\n});\n\n/**\n  Handles when you click the Site Settings tab in admin, but haven't\n  chosen a category. It will redirect to the first category.\n**/\nDiscourse.AdminSiteSettingsIndexRoute = Discourse.Route.extend({\n  model: function() {\n    this.replaceWith('adminSiteSettingsCategory', this.modelFor('adminSiteSettings')[0].nameKey);\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Shows all of the badges that have been granted to a user, and allow granting and
  revoking badges.

  @class AdminUserBadgesRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUserBadgesRoute = Discourse.Route.extend({
  model: function() {
    var username = this.modelFor('adminUser').get('username');
    return Discourse.UserBadge.findByUsername(username);
  },

  setupController: function(controller, model) {
    // Find all badges.
    controller.set('loading', true);
    Discourse.Badge.findAll().then(function(badges) {
      controller.set('badges', badges);
      if (badges.length > 0) {
        var grantableBadges = controller.get('grantableBadges');
        if (grantableBadges.length > 0) {
          controller.set('selectedBadgeId', grantableBadges[0].get('id'));
        }
      }
      controller.set('loading', false);
    });
    // Set the model.
    controller.set('model', model);
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_user_badges_route.js'] = "/**\n  Shows all of the badges that have been granted to a user, and allow granting and\n  revoking badges.\n\n  @class AdminUserBadgesRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUserBadgesRoute = Discourse.Route.extend({\n  model: function() {\n    var username = this.modelFor('adminUser').get('username');\n    return Discourse.UserBadge.findByUsername(username);\n  },\n\n  setupController: function(controller, model) {\n    // Find all badges.\n    controller.set('loading', true);\n    Discourse.Badge.findAll().then(function(badges) {\n      controller.set('badges', badges);\n      if (badges.length \u003e 0) {\n        var grantableBadges = controller.get('grantableBadges');\n        if (grantableBadges.length \u003e 0) {\n          controller.set('selectedBadgeId', grantableBadges[0].get('id'));\n        }\n      }\n      controller.set('loading', false);\n    });\n    // Set the model.\n    controller.set('model', model);\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Shows all the requirements for being at trust level 3 and if the
  given user is meeting them.

  @class AdminUserLeaderRequirementsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUserLeaderRequirementsRoute = Discourse.Route.extend({
  model: function() {
    return this.controllerFor('adminUser').get('model');
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_user_leader_requirements_route.js'] = "/**\n  Shows all the requirements for being at trust level 3 and if the\n  given user is meeting them.\n\n  @class AdminUserLeaderRequirementsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUserLeaderRequirementsRoute = Discourse.Route.extend({\n  model: function() {\n    return this.controllerFor('adminUser').get('model');\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminUserRoute = Discourse.Route.extend({
  serialize: function(model) {
    return { username: model.get('username').toLowerCase() };
  },

  model: function(params) {
    return Discourse.AdminUser.find(Em.get(params, 'username').toLowerCase());
  },

  renderTemplate: function() {
    this.render({into: 'admin/templates/admin'});
  },

  afterModel: function(adminUser) {
    return adminUser.loadDetails().then(function () {
      adminUser.setOriginalTrustLevel();
      return adminUser;
    });
  }
});

Discourse.AdminUserIndexRoute = Discourse.Route.extend({
  model: function() {
    return this.modelFor('adminUser');
  },

  afterModel: function(model) {
    if(Discourse.User.currentProp('admin')) {
      var self = this;
      return Discourse.Group.findAll().then(function(groups){
        self._availableGroups = groups.filterBy('automatic', false);
        return model;
      });
    }
  },

  setupController: function(controller, model) {
    controller.setProperties({
      originalPrimaryGroupId: model.get('primary_group_id'),
      availableGroups: this._availableGroups,
      model: model
    });
  },

  actions: {
    showSuspendModal: function(user) {
      Discourse.Route.showModal(this, 'admin_suspend_user', user);
      this.controllerFor('modal').set('modalClass', 'suspend-user-modal');
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_user_route.js'] = "Discourse.AdminUserRoute = Discourse.Route.extend({\n  serialize: function(model) {\n    return { username: model.get('username').toLowerCase() };\n  },\n\n  model: function(params) {\n    return Discourse.AdminUser.find(Em.get(params, 'username').toLowerCase());\n  },\n\n  renderTemplate: function() {\n    this.render({into: 'admin/templates/admin'});\n  },\n\n  afterModel: function(adminUser) {\n    return adminUser.loadDetails().then(function () {\n      adminUser.setOriginalTrustLevel();\n      return adminUser;\n    });\n  }\n});\n\nDiscourse.AdminUserIndexRoute = Discourse.Route.extend({\n  model: function() {\n    return this.modelFor('adminUser');\n  },\n\n  afterModel: function(model) {\n    if(Discourse.User.currentProp('admin')) {\n      var self = this;\n      return Discourse.Group.findAll().then(function(groups){\n        self._availableGroups = groups.filterBy('automatic', false);\n        return model;\n      });\n    }\n  },\n\n  setupController: function(controller, model) {\n    controller.setProperties({\n      originalPrimaryGroupId: model.get('primary_group_id'),\n      availableGroups: this._availableGroups,\n      model: model\n    });\n  },\n\n  actions: {\n    showSuspendModal: function(user) {\n      Discourse.Route.showModal(this, 'admin_suspend_user', user);\n      this.controllerFor('modal').set('modalClass', 'suspend-user-modal');\n    }\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles the route that deals with listing users

  @class AdminUsersListRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUsersListRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/users_list', {into: 'admin/templates/admin'});
  },

  actions: {
    exportUsers: function() {
      Discourse.ExportCsv.exportUserList();
    }
  }
});

/**
  Index should just redirect to active

  @class AdminUsersIndexRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminUsersList.active');
  }
});

/**
  Handles the route that lists active users.

  @class AdminUsersListActiveRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListActiveRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('active');
  }
});

/**
  Handles the route that lists new users.

  @class AdminUsersListNewRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListNewRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('new');
  }
});

/**
  Handles the route that lists pending users.

  @class AdminUsersListPendingRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListPendingRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('pending');
  }
});

/**
  Handles the route that lists admin users.

  @class AdminUsersListAdminsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListAdminsRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('admins');
  }
});

/**
  Handles the route that lists moderators.

  @class AdminUsersListModeratorsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListModeratorsRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('moderators');
  }
});

/**
  Handles the route that lists blocked users.

  @class AdminUsersListBlockedRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListBlockedRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('blocked');
  }
});

/**
  Handles the route that lists suspended users.

  @class AdminUsersListSuspendedRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListSuspendedRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('suspended');
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_users_list_routes.js'] = "/**\n  Handles the route that deals with listing users\n\n  @class AdminUsersListRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUsersListRoute = Discourse.Route.extend({\n  renderTemplate: function() {\n    this.render('admin/templates/users_list', {into: 'admin/templates/admin'});\n  },\n\n  actions: {\n    exportUsers: function() {\n      Discourse.ExportCsv.exportUserList();\n    }\n  }\n});\n\n/**\n  Index should just redirect to active\n\n  @class AdminUsersIndexRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListIndexRoute = Discourse.Route.extend({\n  redirect: function() {\n    this.transitionTo('adminUsersList.active');\n  }\n});\n\n/**\n  Handles the route that lists active users.\n\n  @class AdminUsersListActiveRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListActiveRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('active');\n  }\n});\n\n/**\n  Handles the route that lists new users.\n\n  @class AdminUsersListNewRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListNewRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('new');\n  }\n});\n\n/**\n  Handles the route that lists pending users.\n\n  @class AdminUsersListPendingRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListPendingRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('pending');\n  }\n});\n\n/**\n  Handles the route that lists admin users.\n\n  @class AdminUsersListAdminsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListAdminsRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('admins');\n  }\n});\n\n/**\n  Handles the route that lists moderators.\n\n  @class AdminUsersListModeratorsRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListModeratorsRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('moderators');\n  }\n});\n\n/**\n  Handles the route that lists blocked users.\n\n  @class AdminUsersListBlockedRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListBlockedRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('blocked');\n  }\n});\n\n/**\n  Handles the route that lists suspended users.\n\n  @class AdminUsersListSuspendedRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListSuspendedRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('suspended');\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles the route that lists users at trust level 0.

  @class AdminUsersListNewuserRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUsersListNewuserRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('newuser');
  }
});

/**
  Handles the route that lists users at trust level 1.

  @class AdminUsersListBasicuserRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListBasicuserRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('basic');
  }
});

/**
  Handles the route that lists users at trust level 2.

  @class AdminUsersListRegularRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListRegularRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('regular');
  }
});

/**
  Handles the route that lists users at trust level 3.

  @class AdminUsersListLeadersRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListLeadersRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('leader');
  }
});

/**
  Handles the route that lists users at trust level 4.

  @class AdminUsersListEldersRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListEldersRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('elder');
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/routes/admin_users_list_trust_level_routes.js'] = "/**\n  Handles the route that lists users at trust level 0.\n\n  @class AdminUsersListNewuserRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUsersListNewuserRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('newuser');\n  }\n});\n\n/**\n  Handles the route that lists users at trust level 1.\n\n  @class AdminUsersListBasicuserRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListBasicuserRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('basic');\n  }\n});\n\n/**\n  Handles the route that lists users at trust level 2.\n\n  @class AdminUsersListRegularRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListRegularRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('regular');\n  }\n});\n\n/**\n  Handles the route that lists users at trust level 3.\n\n  @class AdminUsersListLeadersRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListLeadersRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('leader');\n  }\n});\n\n/**\n  Handles the route that lists users at trust level 4.\n\n  @class AdminUsersListEldersRoute\n  @extends Discourse.Route\n  @namespace Discourse\n  @module Discourse\n**/\nDiscourse.AdminUsersListEldersRoute = Discourse.Route.extend({\n  setupController: function() {\n    return this.controllerFor('adminUsersList').show('elder');\n  }\n});\n";
Ember.TEMPLATES["admin/templates/admin"] = Ember.Handlebars.compile("<div class=\"container\">\n    {{Discourse.globalNotice}}\n    <div class=\"row\">\n      <div class=\"full-width\">\n  \n        <ul class=\"nav nav-pills\">\n          <li>{{#link-to 'admin.dashboard'}}{{i18n admin.dashboard.title}}{{/link-to}}</li>\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'adminSiteSettings'}}{{i18n admin.site_settings.title}}{{/link-to}}</li>\n            <li>{{#link-to 'adminSiteContents'}}{{i18n admin.site_content.title}}{{/link-to}}</li>\n          {{/if}}\n          <li>{{#link-to 'adminUsersList'}}{{i18n admin.users.title}}{{/link-to}}</li>\n          {{#if showBadges}}\n            <li>{{#link-to 'admin.badges'}}{{i18n admin.badges.title}}{{/link-to}}</li>\n          {{/if}}\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'adminGroups.index'}}{{i18n admin.groups.title}}{{/link-to}}</li>\n          {{/if}}\n          <li>{{#link-to 'adminEmail'}}{{i18n admin.email.title}}{{/link-to}}</li>\n          <li>{{#link-to 'adminFlags'}}{{i18n admin.flags.title}}{{/link-to}}</li>\n          <li>{{#link-to 'adminLogs'}}{{i18n admin.logs.title}}{{/link-to}}</li>\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'adminCustomize'}}{{i18n admin.customize.title}}{{/link-to}}</li>\n            <li>{{#link-to 'admin.api'}}{{i18n admin.api.title}}{{/link-to}}</li>\n            <li>{{#link-to 'admin.backups'}}{{i18n admin.backups.title}}{{/link-to}}</li>\n          {{/if}}\n        </ul>\n  \n        <div class='boxed white admin-content'>\n          <div class='admin-contents'>\n            {{outlet}}\n          </div>\n        </div>\n  \n      </div>\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/api"] = Ember.Handlebars.compile("{{#if model}}\n    <table class='api-keys'>\n    <tr>\n      <th>{{i18n admin.api.key}}</th>\n      <th>{{i18n admin.api.user}}</th>\n      <th>&nbsp;</th>\n    </tr>\n    {{#each model}}\n      <tr>\n        <td class='key'>{{key}}</td>\n        <td>\n          {{#if user}}\n            {{#link-to 'adminUser' user}}\n              {{avatar user imageSize=\"small\"}}\n            {{/link-to}}\n          {{else}}\n            {{i18n admin.api.all_users}}\n          {{/if}}\n        </td>\n        <td>\n          <button class='btn' {{action regenerateKey this}}><i class=\"fa fa-undo\"></i>{{i18n admin.api.regenerate}}</button>\n          <button class='btn' {{action revokeKey this}}><i class=\"fa fa-times\"></i>{{i18n admin.api.revoke}}</button>\n        </td>\n      </tr>\n    {{/each}}\n    </table>\n  {{else}}\n    <p>{{i18n admin.api.none}}</p>\n  {{/if}}\n  \n  {{#unless hasMasterKey}}\n    <button class='btn' {{action generateMasterKey}}><i class=\"fa fa-key\"></i>{{i18n admin.api.generate_master}}</button>\n  {{/unless }}");
Ember.TEMPLATES["admin/templates/backups"] = Ember.Handlebars.compile("<div class=\"admin-controls\">\n    <div class=\"span15\">\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to \"admin.backups.index\"}}{{i18n admin.backups.menu.backups}}{{/link-to}}</li>\n        <li>{{#link-to \"admin.backups.logs\"}}{{i18n admin.backups.menu.logs}}{{/link-to}}</li>\n      </ul>\n    </div>\n    <div class=\"pull-right\">\n      {{#if canRollback}}\n        <button {{action rollback}} class=\"btn btn-rollback\" title=\"{{i18n admin.backups.operations.rollback.title}}\" {{bind-attr disabled=\"rollbackDisabled\"}}><i class=\"fa fa-ambulance fa-flip-horizontal\"></i>{{i18n admin.backups.operations.rollback.text}}</button>\n      {{/if}}\n      {{#if isOperationRunning}}\n        <button {{action cancelOperation}} class=\"btn btn-danger\" title=\"{{i18n admin.backups.operations.cancel.title}}\"><i class=\"fa fa-times\"></i>{{i18n admin.backups.operations.cancel.text}}</button>\n      {{else}}\n        <button {{action startBackup}} class=\"btn btn-primary\" title=\"{{i18n admin.backups.operations.backup.title}}\"><i class=\"fa fa-rocket\"></i>{{i18n admin.backups.operations.backup.text}}</button>\n      {{/if}}\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{outlet}}\n  </div>");
Ember.TEMPLATES["admin/templates/backups_index"] = Ember.Handlebars.compile("<table>\n    <tr>\n      <th width=\"55%\">{{i18n admin.backups.columns.filename}}</th>\n      <th width=\"10%\">{{i18n admin.backups.columns.size}}</th>\n      <th>\n        <div class=\"pull-right\">\n          {{resumable-upload target=\"/admin/backups/upload\" success=\"uploadSuccess\" error=\"uploadError\" uploadText=uploadText}}\n          <button {{action toggleReadOnlyMode}} class=\"btn\" {{bind-attr disabled=\"readOnlyModeDisabled\" title=\"readOnlyModeTitle\"}}><i class=\"fa fa-eye\"></i>{{readOnlyModeText}}</button>\n        </div>\n      </th>\n    </tr>\n    {{#each backup in model}}\n      <tr>\n        <td>{{backup.filename}}</td>\n        <td>{{human-size backup.size}}</td>\n        <td>\n          <div class=\"pull-right\">\n            <a {{bind-attr href=\"backup.link\"}} class=\"btn download\" title=\"{{i18n admin.backups.operations.download.title}}\"><i class=\"fa fa-download\"></i>{{i18n admin.backups.operations.download.text}}</a>\n            <button {{action destroyBackup backup}} class=\"btn btn-danger\" {{bind-attr disabled=\"destroyDisabled\" title=\"destroyTitle\"}}><i class=\"fa fa-trash-o\"></i></button>\n            <button {{action startRestore backup}} class=\"btn\" {{bind-attr disabled=\"restoreDisabled\" title=\"restoreTitle\"}}><i class=\"fa fa-play\"></i>{{i18n admin.backups.operations.restore.text}}</button>\n          </div>\n        </td>\n      </tr>\n    {{else}}\n      <tr>\n        <td>{{i18n admin.backups.none}}</td>\n        <td></td>\n        <td></td>\n      </tr>\n    {{/each}}\n  </table>");
Ember.TEMPLATES["admin/templates/badges"] = Ember.Handlebars.compile("<div class=\"badges\">\n  \n    <div class='content-list span6'>\n      <h3>{{i18n admin.badges.title}}</h3>\n      <ul>\n        {{#each}}\n        <li>\n          <a {{action selectBadge this}} {{bind-attr class=\"selected:active\"}}>\n          <span {{bind-attr class=\":user-badge badgeTypeClassName\" data-badge-name=\"name\" title=\"displayDescription\"}}>\n            <i {{bind-attr class=\":fa icon\"}}></i>\n            {{displayName}}\n          </span>\n            {{#if newBadge}}\n              <span class=\"list-badge\">{{i18n filters.new.lower_title}}</span>\n            {{/if}}\n          </a>\n        </li>\n        {{/each}}\n      </ul>\n      <button {{action createNewBadge}} {{bind-attr disabled=newBadgeExists}} class='btn'><i class=\"fa fa-plus\"></i>{{i18n admin.badges.new}}</button>\n    </div>\n  \n    {{#if selectedItem}}\n    {{#with selectedItem controller='adminBadge'}}\n    <div class='current-badge span13'>\n      <form class=\"form-horizontal\">\n        <div>\n          <label for=\"name\">{{i18n admin.badges.name}}</label>\n          {{input type=\"text\" name=\"name\" value=name}}\n        </div>\n  \n        {{#if showDisplayName}}\n          <div>\n            <strong>{{i18n admin.badges.display_name}}</strong>\n            {{displayName}}\n          </div>\n        {{/if}}\n  \n        <div>\n          <label for=\"name\">{{i18n admin.badges.icon}}</label>\n          {{input type=\"text\" name=\"name\" value=icon}}\n        </div>\n  \n        <div>\n          <label for=\"badge_type_id\">{{i18n admin.badges.badge_type}}</label>\n          {{view Ember.Select name=\"badge_type_id\" value=badge_type_id\n                              content=controller.badgeTypes\n                              optionValuePath=\"content.id\"\n                              optionLabelPath=\"content.name\"\n                              disabled=readOnly}}\n        </div>\n  \n        <div>\n          <label for=\"badge_grouping_id\">{{i18n admin.badges.badge_grouping}}</label>\n          {{view Ember.Select name=\"badge_grouping_id\" value=badge_grouping_id\n                              content=controller.badgeGroupings\n                              optionValuePath=\"content.id\"\n                              optionLabelPath=\"content.name\"}}\n          &nbsp;<button {{action editGroupings controller.badgeGroupings}}><i class=\"fa fa-pencil\"></i></button>\n        </div>\n  \n  \n        <div>\n          <label for=\"description\">{{i18n admin.badges.description}}</label>\n          {{#if controller.canEditDescription}}\n            {{textarea name=\"description\" value=description}}\n          {{else}}\n            {{textarea name=\"description\" value=displayDescription disabled=true}}\n          {{/if}}\n        </div>\n  \n        <div>\n          <label for=\"query\">{{i18n admin.badges.query}}</label>\n          {{textarea name=\"query\" value=query disabled=readOnly}}\n        </div>\n  \n        {{#if hasQuery}}\n  \n        <a href {{action preview this \"false\"}}>{{i18n admin.badges.preview.link_text}}</a>\n        |\n        <a href {{action preview this \"true\"}}>{{i18n admin.badges.preview.plan_text}}</a>\n        {{#if preview_loading}}\n          {{i18n loading}}...\n        {{/if}}\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=auto_revoke disabled=readOnly}}\n            {{i18n admin.badges.auto_revoke}}\n          </span>\n        </div>\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=target_posts disabled=readOnly}}\n            {{i18n admin.badges.target_posts}}\n          </span>\n        </div>\n  \n        <div>\n          <label for=\"trigger\">{{i18n admin.badges.trigger}}</label>\n          {{view Ember.Select name=\"trigger\" value=trigger\n                              content=controller.badgeTriggers\n                              optionValuePath=\"content.id\"\n                              optionLabelPath=\"content.name\"\n                              disabled=readOnly}}\n        </div>\n  \n        {{/if}}\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=allow_title}}\n            {{i18n admin.badges.allow_title}}\n          </span>\n        </div>\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=multiple_grant disabled=readOnly}}\n            {{i18n admin.badges.multiple_grant}}\n          </span>\n        </div>\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=listable disabled=readOnly}}\n            {{i18n admin.badges.listable}}\n          </span>\n        </div>\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=show_posts disabled=readOnly}}\n            {{i18n admin.badges.show_posts}}\n          </span>\n        </div>\n  \n        <div>\n          <span>\n            {{input type=\"checkbox\" checked=enabled}}\n            {{i18n admin.badges.enabled}}\n          </span>\n        </div>\n  \n        <div class='buttons'>\n          <button {{action save}} {{bind-attr disabled=controller.disableSave}} class='btn btn-primary'>{{i18n admin.badges.save}}</button>\n          <span class='saving'>{{savingStatus}}</span>\n          {{#unless readOnly}}\n            <a {{action destroy}} class='delete-link'>{{i18n admin.badges.delete}}</a>\n          {{/unless}}\n        </div>\n      </form>\n    </div>\n  \n    {{#if grant_count}}\n    <div class=\"span13 current-badge-actions\">\n      <div>\n        {{#link-to 'badges.show' this}}{{i18n badges.granted count=grant_count}}{{/link-to}}\n      </div>\n    </div>\n    {{/if}}\n    {{/with}}\n    {{/if}}\n  \n  </div>");
Ember.TEMPLATES["admin/templates/commits"] = Ember.Handlebars.compile("<div class=\"commits-widget\">\n    <div class=\"header\" {{action \"goToGithub\"}}>\n      <h1>\n        <i class=\"fa fa-github\"></i>\n        {{i18n admin.commits.latest_changes}}\n      </h1>\n    </div>\n    <ul class=\"commits-list\">\n      {{#each controller}}\n        <li>\n          <div class=\"left\">\n            <img {{bind-attr src=\"gravatarUrl\"}}>\n          </div>\n          <div class=\"right\">\n            <span class=\"commit-message\"><a {{bind-attr href=\"commitUrl\"}} target=\"_blank\">{{ commit.message }}</a></span><br/>\n            <span class=\"commit-meta\">{{i18n admin.commits.by}} <span class=\"committer-name\">{{ commit.author.name }}</span> - <span class=\"commit-time\">{{{ timeAgo }}}</span></span>\n          </div>\n        </li>\n      {{/each}}\n    </ul>\n  </div>");
Ember.TEMPLATES["admin/templates/customize"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminCustomize.colors'}}{{i18n admin.customize.colors.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminCustomize.css_html'}}{{i18n admin.customize.css_html.title}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{outlet}}\n  </div>");
Ember.TEMPLATES["admin/templates/customize_colors"] = Ember.Handlebars.compile("<div class='content-list span6'>\n    <h3>{{i18n admin.customize.colors.long_title}}</h3>\n    <ul>\n      {{#each model}}\n        {{#unless is_base}}\n          <li><a {{action selectColorScheme this}} {{bind-attr class=\"selected:active\"}}>{{description}}</a></li>\n        {{/unless}}\n      {{/each}}\n    </ul>\n    <button {{action newColorScheme}} class='btn'><i class=\"fa fa-plus\"></i>{{i18n admin.customize.new}}</button>\n  </div>\n  \n  {{#if selectedItem}}\n    <div class=\"current-style color-scheme\">\n      <div class=\"admin-container\">\n        {{#with selectedItem}}\n          <h1>{{text-field class=\"style-name\" value=name}}</h1>\n  \n          <div class=\"controls\">\n            <button {{action save}} {{bind-attr disabled=\"disableSave\"}} class='btn'>{{i18n admin.customize.save}}</button>\n            <button {{action toggleEnabled}} {{bind-attr disabled=\"disableEnable\"}} class=\"btn\">\n              {{#if enabled}}\n                {{i18n disable}}\n              {{else}}\n                {{i18n enable}}\n              {{/if}}\n            </button>\n            <button {{action copy this}} class='btn'><i class=\"fa fa-copy\"></i> {{i18n admin.customize.copy}}</button>\n            <button {{action destroy}} class='btn btn-danger'><i class=\"fa fa-trash-o\"></i> {{i18n admin.customize.delete}}</button>\n            <span {{bind-attr class=\":saving savingStatus::hidden\" }}>{{savingStatus}}</span>\n          </div>\n        {{/with}}\n  \n        <br/>\n  \n        <div class='admin-controls'>\n          <div class='search controls'>\n            <label>\n              {{input type=\"checkbox\" checked=onlyOverridden}}\n              {{i18n admin.site_settings.show_overriden}}\n            </label>\n          </div>\n        </div>\n  \n        {{#if colors.length}}\n        <table class=\"table colors\">\n          <thead>\n            <tr>\n              <th></th>\n              <th class=\"hex\">{{i18n admin.customize.color}}</th>\n              <th></th>\n            </tr>\n          </thead>\n          <tbody>\n            {{#each colors}}\n              <tr {{bind-attr class=\"changed valid:valid:invalid\"}}>\n                <td class=\"name\" {{bind-attr title=\"name\"}}>\n                  <b>{{translatedName}}</b>\n                  <br/>\n                  <span class=\"description\">{{description}}</span>\n                </td>\n                <td class=\"hex\">{{color-input hexValue=hex brightnessValue=brightness valid=valid}}</td>\n                <td class=\"actions\">\n                  <button {{bind-attr class=\":btn :revert savedIsOverriden::invisible\"}} {{action revert this}} title=\"{{i18n admin.customize.colors.revert_title}}\">{{i18n revert}}</button>\n                  <button {{bind-attr class=\":btn :undo changed::invisible\"}} {{action undo this}} title=\"{{i18n admin.customize.colors.undo_title}}\">{{i18n undo}}</button>\n                </td>\n              </tr>\n            {{/each}}\n          </tbody>\n        </table>\n        {{else}}\n          <p>{{i18n search.no_results}}</p>\n        {{/if}}\n      </div>\n    </div>\n  {{else}}\n    <p class=\"about\">{{i18n admin.customize.colors.about}}</p>\n  {{/if}}\n  \n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/customize_css_html"] = Ember.Handlebars.compile("<div class='content-list span6'>\n    <h3>{{i18n admin.customize.css_html.long_title}}</h3>\n    <ul>\n      {{#each model}}\n      <li><a {{action selectStyle this}} {{bind-attr class=\"this.selected:active\"}}>{{this.description}}</a></li>\n      {{/each}}\n    </ul>\n    <button {{action newCustomization}} class='btn'><i class=\"fa fa-plus\"></i>{{i18n admin.customize.new}}</button>\n  </div>\n  \n  \n  {{#if selectedItem}}\n  <div class='current-style'>\n    {{#with selectedItem}}\n      {{text-field class=\"style-name\" value=name}}\n  \n      <div class='admin-controls'>\n        <ul class=\"nav nav-pills\">\n          <li>\n            <a {{bind-attr class=\"view.stylesheetActive:active\"}}{{action selectStylesheet href=\"true\" target=\"view\"}}>{{i18n admin.customize.css}}</a>\n          </li>\n          <li>\n            <a {{bind-attr class=\"view.headerActive:active\"}}{{action selectHeader href=\"true\" target=\"view\"}}>{{i18n admin.customize.header}}</a>\n          </li>\n          <li>\n            <a {{bind-attr class=\"view.mobileStylesheetActive:active\"}}{{action selectMobileStylesheet href=\"true\" target=\"view\"}}>{{i18n admin.customize.mobile_css}}</a>\n          </li>\n          <li>\n            <a {{bind-attr class=\"view.mobileHeaderActive:active\"}}{{action selectMobileHeader href=\"true\" target=\"view\"}}>{{i18n admin.customize.mobile_header}}</a>\n          </li>\n        </ul>\n      </div>\n  \n      <div class=\"admin-container\">\n        {{#if view.headerActive}}\n          {{aceEditor content=header mode=\"html\"}}\n        {{/if}}\n        {{#if view.stylesheetActive}}\n          {{aceEditor content=stylesheet mode=\"scss\"}}\n        {{/if}}\n        {{#if view.mobileHeaderActive}}\n          {{aceEditor content=mobile_header mode=\"html\"}}\n        {{/if}}\n        {{#if view.mobileStylesheetActive}}\n          {{aceEditor content=mobile_stylesheet mode=\"scss\"}}\n        {{/if}}\n      </div>\n    {{/with}}\n    <br>\n    <div class='status-actions'>\n      <span>{{i18n admin.customize.override_default}} {{view Ember.Checkbox checkedBinding=\"selectedItem.override_default_style\"}}</span>\n      <span>{{i18n admin.customize.enabled}}  {{view Ember.Checkbox checkedBinding=\"selectedItem.enabled\"}}</span>\n      {{#unless selectedItem.changed}}\n      <a class='preview-link' {{bind-attr href=\"selectedItem.previewUrl\"}} target='_blank' title=\"{{i18n admin.customize.explain_preview}}\">{{i18n admin.customize.preview}}</a>\n      |\n      <a href=\"/?preview-style=\" target='_blank' title=\"{{i18n admin.customize.explain_undo_preview}}\">{{i18n admin.customize.undo_preview}}</a>\n      |\n      <a href=\"/?preview-style=default\" target='_blank' title=\"{{i18n admin.customize.explain_rescue_preview}}\">{{i18n admin.customize.rescue_preview}}</a><br>\n      {{/unless}}\n    </div>\n  \n    <div class='buttons'>\n      <button {{action save}} {{bind-attr disabled=\"selectedItem.disableSave\"}} class='btn'>{{i18n admin.customize.save}}</button>\n      <span class='saving'>{{selectedItem.savingStatus}}</span>\n      <a {{action destroy}} class='delete-link'>{{i18n admin.customize.delete}}</a>\n    </div>\n  \n  </div>\n  {{else}}\n    <p class=\"about\">{{i18n admin.customize.about}}</p>\n  {{/if}}\n  <div class='clearfix'></div>");
Ember.TEMPLATES["admin/templates/dashboard"] = Ember.Handlebars.compile("<div class=\"dashboard-left\">\n    {{#if foundProblems}}\n      <div class=\"dashboard-stats detected-problems\">\n        <div class=\"look-here\"><i class=\"fa fa-exclamation-triangle\"></i></div>\n        <div class=\"problem-messages\">\n          <p {{bind-attr class=\"loadingProblems:invisible\"}}>\n            {{i18n admin.dashboard.problems_found}}\n            <ul {{bind-attr class=\"loadingProblems:invisible\"}}>\n              {{#each problem in problems}}\n                <li>{{{problem}}}</li>\n              {{/each}}\n            </ul>\n          </p>\n          <p class=\"actions\">\n            <small>{{i18n admin.dashboard.last_checked}}: {{problemsTimestamp}}</small>\n            <button {{action refreshProblems}} class=\"btn btn-small\"><i class=\"fa fa-refresh\"></i>{{i18n admin.dashboard.refresh_problems}}</button>\n          </p>\n        </div>\n        <div class=\"clearfix\"></div>\n      </div>\n    {{else}}\n      {{#if thereWereProblems}}\n        <div class=\"dashboard-stats detected-problems\">\n          <div class=\"look-here\">&nbsp;</div>\n          <div class=\"problem-messages\">\n            <p>\n              {{i18n admin.dashboard.no_problems}}\n              <button {{action refreshProblems}} class=\"btn btn-small\"><i class=\"fa fa-refresh\"></i>{{i18n admin.dashboard.refresh_problems}}</button>\n            </p>\n          </div>\n          <div class=\"clearfix\"></div>\n        </div>\n      {{/if}}\n    {{/if}}\n  \n    {{#if Discourse.SiteSettings.version_checks}}\n      {{partial 'admin/templates/version_checks'}}\n    {{/if}}\n  \n    <div class=\"dashboard-stats trust-levels\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>0</th>\n            <th>1</th>\n            <th>2</th>\n            <th>3</th>\n            <th>4</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin/templates/reports/trust_levels_report' users_by_trust_level tagName=\"tbody\" }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats totals\">\n      <table>\n        <tr>\n          <td class=\"title\"><i class='fa fa-shield'></i> {{i18n admin.dashboard.admins}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.admins'}}{{admins}}{{/link-to}}</td>\n          <td class=\"title\"><i class='fa fa-ban'></i> {{i18n admin.dashboard.suspended}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.suspended'}}{{suspended}}{{/link-to}}</td>\n        </tr>\n        <tr>\n          <td class=\"title\"><i class='fa fa-shield'></i> {{i18n admin.dashboard.moderators}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.moderators'}}{{moderators}}{{/link-to}}</td>\n          <td class=\"title\"><i class='fa fa-ban'></i> {{i18n admin.dashboard.blocked}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.blocked'}}{{blocked}}{{/link-to}}</td>\n        </tr>\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.last_7_days}}</th>\n            <th>{{i18n admin.dashboard.reports.last_30_days}}</th>\n            <th>{{i18n admin.dashboard.reports.all}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin_report_counts' signups }}\n          {{ render 'admin_report_counts' topics }}\n          {{ render 'admin_report_counts' posts }}\n          {{ render 'admin_report_counts' likes }}\n          {{ render 'admin_report_counts' flags }}\n          {{ render 'admin_report_counts' bookmarks }}\n          {{ render 'admin_report_counts' starred }}\n          {{ render 'admin_report_counts' emails }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\" title=\"{{i18n admin.dashboard.private_messages_title}}\"><i class=\"fa fa-envelope\"></i> {{i18n admin.dashboard.private_messages_short}}</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.last_7_days}}</th>\n            <th>{{i18n admin.dashboard.reports.last_30_days}}</th>\n            <th>{{i18n admin.dashboard.reports.all}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin_report_counts' user_to_user_private_messages }}\n          {{ render 'admin_report_counts' system_private_messages }}\n          {{ render 'admin_report_counts' notify_moderators_private_messages }}\n          {{ render 'admin_report_counts' notify_user_private_messages }}\n          {{ render 'admin_report_counts' moderator_warning_private_messages }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.7_days_ago}}</th>\n            <th>{{i18n admin.dashboard.reports.30_days_ago}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin/templates/reports/per_day_counts_report' visits tagName=\"tbody\"}}\n        {{/unless}}\n      </table>\n    </div>\n  </div>\n  \n  <div class=\"dashboard-right\">\n    {{ render 'admin/templates/commits' githubCommits }}\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_referred_topics.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_referred_topics.ytitles.num_clicks}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each data in top_referred_topics.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">\n                  <div class=\"referred-topic-title\">\n                    <div class=\"overflow-ellipsis\">\n                      <a href=\"/t/{{unbound data.topic_slug}}/{{unbound data.topic_id}}\">{{data.topic_title}}</a>\n                    </div>\n                  </div>\n                </td>\n                <td class=\"value\">{{data.num_clicks}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_traffic_sources.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_traffic_sources.ytitles.num_clicks}}</th>\n            <th>{{top_traffic_sources.ytitles.num_topics}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each top_traffic_sources.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">{{domain}}</td>\n                <td class=\"value\">{{num_clicks}}</td>\n                <td class=\"value\">{{num_topics}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_referrers.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_referrers.ytitles.num_clicks}}</th>\n            <th>{{top_referrers.ytitles.num_topics}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each top_referrers.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">{{#link-to 'adminUser' this}}{{unbound username}}{{/link-to}}</td>\n                <td class=\"value\">{{num_clicks}}</td>\n                <td class=\"value\">{{num_topics}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  </div>\n  <div class='clearfix'></div>\n  \n  <div class=\"dashboard-stats pull-right\">\n    <div class=\"pull-right\">{{i18n admin.dashboard.last_updated}} {{updatedTimestamp}}</div>\n    <div class='clearfix'></div>\n  </div>\n  <div class='clearfix'></div>");
Ember.TEMPLATES["admin/templates/email"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminEmail.index'}}{{i18n admin.email.settings}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.all'}}{{i18n admin.email.all}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.sent'}}{{i18n admin.email.sent}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.skipped'}}{{i18n admin.email.skipped}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.previewDigest'}}{{i18n admin.email.preview_digest}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{outlet}}\n  </div>");
Ember.TEMPLATES["admin/templates/email_all"] = Ember.Handlebars.compile("<table class='table'>\n    <thead>\n      <tr>\n        <th>{{i18n admin.email.time}}</th>\n        <th>{{i18n admin.email.user}}</th>\n        <th>{{i18n admin.email.to_address}}</th>\n        <th>{{i18n admin.email.email_type}}</th>\n        <th>{{i18n admin.email.skipped_reason}}</th>\n      </tr>\n    </thead>\n  \n    <tr class=\"filters\">\n      <td>{{i18n admin.email.logs.filters.title}}</td>\n      <td>{{text-field value=filter.user placeholderKey=\"admin.email.logs.filters.user_placeholder\"}}</td>\n      <td>{{text-field value=filter.address placeholderKey=\"admin.email.logs.filters.address_placeholder\"}}</td>\n      <td>{{text-field value=filter.type placeholderKey=\"admin.email.logs.filters.type_placeholder\"}}</td>\n      <td>{{text-field value=filter.skipped_reason placeholderKey=\"admin.email.logs.filters.skipped_reason_placeholder\"}}</td>\n    </tr>\n  \n    {{#each model}}\n      <tr>\n        <td>{{date created_at}}</td>\n        <td>\n          {{#if user}}\n            {{#link-to 'adminUser' user}}{{avatar user imageSize=\"tiny\"}}{{/link-to}}\n            {{#link-to 'adminUser' user}}{{user.username}}{{/link-to}}\n          {{else}}\n            &mdash;\n          {{/if}}\n        </td>\n        <td><a href='mailto:{{unbound to_address}}'>{{to_address}}</a></td>\n        <td>{{email_type}}</td>\n        <td>{{skipped_reason}}</td>\n      </tr>\n    {{else}}\n      <tr><td colspan=\"5\">{{i18n admin.email.logs.none}}</td></tr>\n    {{/each}}\n  \n  </table>");
Ember.TEMPLATES["admin/templates/email_index"] = Ember.Handlebars.compile("<table class=\"table\">\n    <tr>\n      <th>{{i18n admin.email.delivery_method}}</th>\n      <td>{{model.delivery_method}}</td>\n    </tr>\n  \n    {{#each model.settings}}\n      <tr>\n        <th style='width: 25%'>{{name}}</th>\n        <td>{{value}}</td>\n      </tr>\n    {{/each}}\n  </table>\n  \n  <div class='admin-controls'>\n    {{#if sendingEmail}}\n    <div class='span15 controls'>{{i18n admin.email.sending_test}}</div>\n    {{else}}\n    <div class='controls'>\n      {{text-field value=testEmailAddress placeholderKey=\"admin.email.test_email_address\"}}\n    </div>\n    <div class='span10 controls'>\n      <button class='btn btn-primary' {{action sendTestEmail}} {{bind-attr disabled=\"sendTestEmailDisabled\"}}>{{i18n admin.email.send_test}}</button>\n      {{#if sentTestEmail}}<span class='result-message'>{{i18n admin.email.sent_test}}</span>{{/if}}\n    </div>\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/email_preview_digest"] = Ember.Handlebars.compile("<p>{{i18n admin.email.preview_digest_desc}}</p>\n  \n  <div class='admin-controls'>\n    <div class='span7 controls'>\n      <label for='last-seen'>{{i18n admin.email.last_seen_user}}</label>\n      {{input type=\"date\" value=lastSeen id=\"last-seen\"}}\n    </div>\n    <div>\n      <button class='btn' {{action refresh}}>{{i18n admin.email.refresh}}</button>\n    </div>\n    <div class=\"span7 toggle\">\n      <label>{{i18n admin.email.format}}</label>\n      {{#if showHtml}}\n        <span>{{i18n admin.email.html}}</span> | <a href='#' {{action toggleShowHtml}}>{{i18n admin.email.text}}</a>\n      {{else}}\n        <a href='#' {{action toggleShowHtml}}>{{i18n admin.email.html}}</a> | <span>{{i18n admin.email.text}}</span>\n      {{/if}}\n    </div>\n  </div>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if showHtml}}\n      {{{html_content}}}\n    {{else}}\n      <pre>{{{text_content}}}</pre>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/email_sent"] = Ember.Handlebars.compile("<table class='table'>\n    <thead>\n      <tr>\n        <th>{{i18n admin.email.sent_at}}</th>\n        <th>{{i18n admin.email.user}}</th>\n        <th>{{i18n admin.email.to_address}}</th>\n        <th>{{i18n admin.email.email_type}}</th>\n        <th>{{i18n admin.email.reply_key}}</th>\n      </tr>\n    </thead>\n  \n    <tr class=\"filters\">\n      <td>{{i18n admin.email.logs.filters.title}}</td>\n      <td>{{text-field value=filter.user placeholderKey=\"admin.email.logs.filters.user_placeholder\"}}</td>\n      <td>{{text-field value=filter.address placeholderKey=\"admin.email.logs.filters.address_placeholder\"}}</td>\n      <td>{{text-field value=filter.type placeholderKey=\"admin.email.logs.filters.type_placeholder\"}}</td>\n      <td>{{text-field value=filter.reply_key placeholderKey=\"admin.email.logs.filters.reply_key_placeholder\"}}</td>\n    </tr>\n  \n    {{#each model}}\n      <tr>\n        <td>{{date created_at}}</td>\n        <td>\n          {{#if user}}\n            {{#link-to 'adminUser' user}}{{avatar user imageSize=\"tiny\"}}{{/link-to}}\n            {{#link-to 'adminUser' user}}{{user.username}}{{/link-to}}\n          {{else}}\n            &mdash;\n          {{/if}}\n        </td>\n        <td><a href='mailto:{{unbound to_address}}'>{{to_address}}</a></td>\n        <td>{{email_type}}</td>\n        <td>{{reply_key}}</td>\n      </tr>\n    {{else}}\n      <tr><td colspan=\"5\">{{i18n admin.email.logs.none}}</td></tr>\n    {{/each}}\n  \n  </table>");
Ember.TEMPLATES["admin/templates/email_skipped"] = Ember.Handlebars.compile("<table class='table'>\n    <thead>\n      <tr>\n        <th>{{i18n admin.email.time}}</th>\n        <th>{{i18n admin.email.user}}</th>\n        <th>{{i18n admin.email.to_address}}</th>\n        <th>{{i18n admin.email.email_type}}</th>\n        <th>{{i18n admin.email.skipped_reason}}</th>\n      </tr>\n    </thead>\n  \n    <tr class=\"filters\">\n      <td>{{i18n admin.email.logs.filters.title}}</td>\n      <td>{{text-field value=filter.user placeholderKey=\"admin.email.logs.filters.user_placeholder\"}}</td>\n      <td>{{text-field value=filter.address placeholderKey=\"admin.email.logs.filters.address_placeholder\"}}</td>\n      <td>{{text-field value=filter.type placeholderKey=\"admin.email.logs.filters.type_placeholder\"}}</td>\n      <td>{{text-field value=filter.skipped_reason placeholderKey=\"admin.email.logs.filters.skipped_reason_placeholder\"}}</td>\n    </tr>\n  \n    {{#each model}}\n      <tr>\n        <td>{{date created_at}}</td>\n        <td>\n          {{#if user}}\n            {{#link-to 'adminUser' user}}{{avatar user imageSize=\"tiny\"}}{{/link-to}}\n            {{#link-to 'adminUser' user}}{{user.username}}{{/link-to}}\n          {{else}}\n            &mdash;\n          {{/if}}\n        </td>\n        <td><a href='mailto:{{unbound to_address}}'>{{to_address}}</a></td>\n        <td>{{email_type}}</td>\n        <td>{{skipped_reason}}</td>\n      </tr>\n    {{else}}\n      <tr><td colspan=\"5\">{{i18n admin.email.logs.none}}</td></tr>\n    {{/each}}\n  \n  </table>");
Ember.TEMPLATES["admin/templates/flags"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminFlags.active'}}{{i18n admin.flags.active}}{{/link-to}}</li>\n        <li>{{#link-to 'adminFlags.old'}}{{i18n admin.flags.old}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{#if loading}}\n      <div class='admin-loading'>{{i18n loading}}</div>\n    {{else}}\n      {{#if length}}\n        <table class='admin-flags'>\n          <thead>\n            <tr>\n              <th class='user'></th>\n              <th class='excerpt'></th>\n              <th class='flaggers'>{{i18n admin.flags.flagged_by}}</th>\n              <th class='flaggers'>{{#if adminOldFlagsView}}{{i18n admin.flags.resolved_by}}{{/if}}</th>\n            </tr>\n          </thead>\n          <tbody>\n            {{#each flaggedPost in content}}\n              <tr {{bind-attr class=\"flaggedPost.extraClasses\"}}>\n  \n                <td class='user'>\n                  {{#if flaggedPost.postAuthorFlagged}}\n                    {{#if flaggedPost.user}}\n                      {{#link-to 'adminUser' flaggedPost.user}}{{avatar flaggedPost.user imageSize=\"small\"}}{{/link-to}}\n                      {{#if flaggedPost.wasEdited}}<i class=\"fa fa-pencil\" title=\"{{i18n admin.flags.was_edited}}\"></i>{{/if}}\n                    {{/if}}\n                  {{/if}}\n                </td>\n  \n                <td class='excerpt'>\n                  <h3>\n                    {{#if flaggedPost.topic.isPrivateMessage}}\n                      <span class=\"private-message-glyph\">{{icon envelope}}</span>\n                    {{/if}}\n                    {{topic-status topic=flaggedPost.topic}}\n                    <a href='{{unbound flaggedPost.url}}'>{{flaggedPost.topic.title}}</a>\n                  </h3>\n                  {{#if flaggedPost.postAuthorFlagged}}\n                    {{{flaggedPost.excerpt}}}\n                  {{/if}}\n                </td>\n  \n                <td class='flaggers'>\n                  <table>\n                    <tbody>\n                      {{#each flaggedPost.flaggers}}\n                        <tr>\n                          <td class='avatar'>\n                            {{#link-to 'adminUser' user}}\n                              {{avatar user imageSize=\"small\"}}\n                            {{/link-to}}\n                          </td>\n                          <td>\n                            {{#link-to 'adminUser' user}}\n                              {{user.username}}\n                            {{/link-to}}\n                            {{age flaggedAt}}\n                            <br />\n                            {{flagType}}\n                          </td>\n                        </tr>\n                      {{/each}}\n                    </tbody>\n                  </table>\n                </td>\n  \n                <td class='flaggers result'>\n                  {{#if adminOldFlagsView}}\n                    <table>\n                      <tbody>\n                        {{#each flaggedPost.flaggers}}\n                          <tr>\n                            <td class='avatar'>\n                              {{#link-to 'adminUser' disposedBy}}\n                                {{avatar disposedBy imageSize=\"small\"}}\n                              {{/link-to}}\n                            </td>\n                            <td>\n                              {{age disposedAt}}\n                              {{{dispositionIcon}}}\n                              {{#if tookAction}}\n                                <i class='fa fa-gavel' title='{{i18n admin.flags.took_action}}'></i>\n                              {{/if}}\n                            </td>\n                          </tr>\n                        {{/each}}\n                      </tbody>\n                    </table>\n                  {{/if}}\n                </td>\n  \n              </tr>\n  \n              {{#if flaggedPost.topicFlagged}}\n                <tr class='message'>\n                  <td></td>\n                  <td colspan=\"3\">\n                    <div>\n                      {{{i18n admin.flags.topic_flagged}}}&nbsp;<a href='{{unbound flaggedPost.url}}' class=\"btn\">{{i18n admin.flags.visit_topic}}</a>\n                    </div>\n                  </td>\n                </tr>\n              {{/if}}\n  \n              {{#each flaggedPost.conversations}}\n                <tr class='message'>\n                  <td></td>\n                  <td colspan=\"3\">\n                    <div>\n                      {{#if response}}\n                        <p>\n                          {{#link-to 'adminUser' response.user}}{{avatar response.user imageSize=\"small\"}}{{/link-to}}&nbsp;{{{response.excerpt}}}\n                        </p>\n                        {{#if reply}}\n                          <p>\n                            {{#link-to 'adminUser' reply.user}}{{avatar reply.user imageSize=\"small\"}}{{/link-to}}&nbsp;{{{reply.excerpt}}}\n                            {{#if hasMore}}\n                              <a href=\"{{unbound permalink}}\">{{i18n admin.flags.more}}</a>\n                            {{/if}}\n                          </p>\n                        {{/if}}\n                        <a href=\"{{unbound permalink}}\">\n                          <button class='btn btn-reply'><i class=\"fa fa-reply\"></i>&nbsp;{{i18n admin.flags.reply_message}}</button>\n                        </a>\n                      {{/if}}\n                    </div>\n                  </td>\n                </tr>\n              {{/each}}\n  \n              <tr>\n                <td colspan=\"4\" class=\"action\">\n                  {{#if adminActiveFlagsView}}\n                    <button title='{{i18n admin.flags.agree_title}}' class='btn' {{action showAgreeFlagModal flaggedPost}}><i class=\"fa fa-thumbs-o-up\"></i>{{i18n admin.flags.agree}}&hellip;</button>\n                    {{#if flaggedPost.postHidden}}\n                      <button title='{{i18n admin.flags.disagree_flag_unhide_post_title}}' class='btn' {{action disagreeFlags flaggedPost}}><i class=\"fa fa-thumbs-o-down\"></i>{{i18n admin.flags.disagree_flag_unhide_post}}</button>\n                    {{else}}\n                      <button title='{{i18n admin.flags.disagree_flag_title}}' class='btn' {{action disagreeFlags flaggedPost}}><i class=\"fa fa-thumbs-o-down\"></i>{{i18n admin.flags.disagree_flag}}</button>\n                    {{/if}}\n                    <button title='{{i18n admin.flags.defer_flag_title}}' class='btn' {{action deferFlags flaggedPost}}><i class=\"fa fa-external-link\"></i>{{i18n admin.flags.defer_flag}}</button>\n                    <button title='{{i18n admin.flags.delete_title}}' class='btn btn-danger' {{action showDeleteFlagModal flaggedPost}}><i class=\"fa fa-trash-o\"></i>{{i18n admin.flags.delete}}&hellip;</button>\n                  {{/if}}\n                </td>\n              </tr>\n  \n            {{/each}}\n  \n          </tbody>\n        </table>\n        {{#if view.loading}}\n          <div class='admin-loading'>{{i18n loading}}</div>\n        {{/if}}\n  \n      {{else}}\n        <p>{{i18n admin.flags.no_results}}</p>\n      {{/if}}\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/group"] = Ember.Handlebars.compile("{{#if automatic}}\n    <h3>{{name}}</h3>\n  {{else}}\n    {{text-field value=name placeholderKey=\"admin.groups.name_placeholder\"}}\n  {{/if}}\n  \n  <div class=\"control-group\">\n    <label class=\"control-label\">{{i18n admin.groups.group_members}}</label>\n    <div class=\"controls\">\n      {{user-selector usernames=usernames id=\"group-users\" placeholderKey=\"admin.groups.selector_placeholder\" tabindex=\"1\" disabled=automatic}}\n    </div>\n  </div>\n  <div class=\"control-group\">\n    <div class=\"controls\">\n      {{input type=\"checkbox\" checked=visible}} {{i18n groups.visible}}\n    </div>\n  </div>\n  <div class=\"control-group\">\n    <label class=\"control-label\">{{i18n groups.alias_levels.title}}</label>\n    <div class=\"controls\">\n      {{combo-box valueAttribute=\"value\" value=alias_level content=aliasLevelOptions}}\n    </div>\n  </div>\n  <div class='controls'>\n    <button {{action save}} {{bind-attr disabled=\"disableSave\"}} class='btn'>{{i18n admin.customize.save}}</button>\n    {{#unless automatic}}\n      <a {{action destroy}} class='delete-link'>{{i18n admin.customize.delete}}</a>\n    {{/unless}}\n  </div>");
Ember.TEMPLATES["admin/templates/groups"] = Ember.Handlebars.compile("<div class='row groups'>\n    <div class='content-list span6'>\n      <h3>{{i18n admin.groups.edit}}</h3>\n      <ul>\n        {{#each group in arrangedContent}}\n          <li>\n          <a href='#' {{action showGroup group}}>{{group.name}} <span class=\"count\">{{group.userCountDisplay}}</span></a>\n          </li>\n        {{/each}}\n      </ul>\n      <div class='controls'>\n        <button class='btn' {{bind-attr disabled=\"refreshingAutoGroups\"}} {{action \"refreshAutoGroups\"}}><i class=\"fa fa-refresh\"></i>{{i18n admin.groups.refresh}}</button>\n        <button class='btn' {{action newGroup}}><i class=\"fa fa-plus\"></i>{{i18n admin.groups.new}}</button>\n      </div>\n    </div>\n  \n    <div class='content-editor'>\n      {{outlet}}\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/groups_index"] = Ember.Handlebars.compile("{{i18n admin.groups.about}}");
Ember.TEMPLATES["admin/templates/logs"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminLogs.staffActionLogs'}}{{i18n admin.logs.staff_actions.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedEmails'}}{{i18n admin.logs.screened_emails.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedIpAddresses'}}{{i18n admin.logs.screened_ips.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedUrls'}}{{i18n admin.logs.screened_urls.title}}{{/link-to}}</li>\n        <li><a href=\"/logs\" data-auto-route=\"true\">{{i18n admin.logs.logster.title}}</a></li>\n      </ul>\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{outlet}}\n  </div>");
Ember.TEMPLATES["admin/templates/logs/_site_customization_change_details"] = Ember.Handlebars.compile("<section class=\"field\">\n    <b>{{i18n admin.customize.css}}</b>:\n    {{#if stylesheet}}\n      ({{i18n character_count count=stylesheet.length}})\n    {{/if}}\n    <br/>\n    {{textarea value=stylesheet class=\"plain\"}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.header}}</b>:\n    {{#if header}}\n      ({{i18n character_count count=header.length}})\n    {{/if}}\n    <br/>\n    {{textarea value=header class=\"plain\"}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.enabled}}</b>: {{enabled}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.override_default}}</b>: {{override_default_style}}\n  </section>");
Ember.TEMPLATES["admin/templates/logs/details_modal"] = Ember.Handlebars.compile("<div class=\"modal-body\">\n    <pre>{{details}}</pre>\n  </div>\n  <div class=\"modal-footer\">\n    <button class='btn btn-primary' {{action closeModal}}>{{i18n close}}</button>\n  </div>");
Ember.TEMPLATES["admin/templates/logs/screened_emails"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_emails.description}}</p>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table screened-emails'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first email\">{{i18n admin.logs.screened_emails.email}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"col heading ip_address\">{{i18n admin.logs.ip_address}}</div>\n          <div class=\"col heading action\"></div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedEmailsListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_emails_list_item"] = Ember.Handlebars.compile("<div class=\"col first email\">\n    <div class=\"overflow-ellipsis\" {{bind-attr title=\"email\"}}>{{email}}</div>\n  </div>\n  <div class=\"col action\">{{actionName}}</div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">{{age-with-tooltip last_match_at}}</div>\n  <div class=\"col created_at\">{{age-with-tooltip created_at}}</div>\n  <div class=\"col ip_address\">{{ip_address}}</div>\n  <div class=\"col action\"><button class=\"btn\" {{action clearBlock this}}><i class='fa fa-check'></i> {{i18n admin.logs.screened_emails.actions.allow}}</button></div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/screened_ip_addresses"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_ips.description}}</p>\n  \n  {{screened-ip-address-form action=\"recordAdded\"}}\n  <br/>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table admin-logs-table screened-ip-addresses'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first ip_address\">{{i18n admin.logs.ip_address}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"col heading actions\"></div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedIpAddressesListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_ip_addresses_list_item"] = Ember.Handlebars.compile("<div class=\"col first ip_address\">\n    {{#if editing}}\n      {{text-field value=ip_address autofocus=\"autofocus\"}}\n    {{else}}\n      <span {{action edit this}}>{{ip_address}}</span>\n    {{/if}}\n  </div>\n  <div class=\"col action\">\n    <i {{bind-attr class=\":fa actionIcon\"}}></i>\n    {{actionName}}\n  </div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">\n    {{#if last_match_at}}\n      {{age-with-tooltip last_match_at}}\n    {{/if}}\n  </div>\n  <div class=\"col created_at\">{{age-with-tooltip created_at}}</div>\n  <div class=\"col actions\">\n    {{#unless editing}}\n      <button class=\"btn btn-danger\" {{action destroy this}}><i class=\"fa fa-trash-o\"></i></button>\n      <button class=\"btn\" {{action edit this}}><i class=\"fa fa-pencil\"></i></button>\n      {{#if isBlocked}}\n        <button class=\"btn\" {{action allow this}}><i {{bind-attr class=\":fa doNothingIcon\"}}></i> {{i18n admin.logs.screened_ips.actions.do_nothing}}</button>\n      {{else}}\n        <button class=\"btn\" {{action block this}}><i {{bind-attr class=\":fa blockIcon\"}}></i> {{i18n admin.logs.screened_ips.actions.block}}</button>\n      {{/if}}\n    {{else}}\n      <button class=\"btn\" {{action save this}}>{{i18n admin.logs.save}}</button>\n      <a {{action cancel this}}>{{i18n cancel}}</a>\n    {{/unless}}\n  </div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/screened_urls"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_urls.description}}</p>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table screened-urls'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first domain\">{{i18n admin.logs.screened_urls.domain}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedUrlsListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_urls_list_item"] = Ember.Handlebars.compile("<div class=\"col first domain\">\n    <div class=\"overflow-ellipsis\" {{bind-attr title=\"domain\"}}>{{domain}}</div>\n  </div>\n  <div class=\"col action\">{{actionName}}</div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">{{age-with-tooltip last_match_at}}</div>\n  <div class=\"col created_at\">{{age-with-tooltip created_at}}</div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/site_customization_change_modal"] = Ember.Handlebars.compile("<div>\n    <ul class=\"nav nav-pills\">\n      <li {{bind-attr class=\"newSelected:active\"}}>\n        <a href=\"#\" {{action selectNew}}>{{i18n admin.logs.staff_actions.new_value}}</a>\n      </li>\n      <li {{bind-attr class=\"previousSelected:active\"}}>\n        <a href=\"#\" {{action selectPrevious}}>{{i18n admin.logs.staff_actions.previous_value}}</a>\n      </li>\n    </ul>\n    <div class=\"modal-body\">\n      <div {{bind-attr class=\":modal-tab :new-tab newSelected::invisible\"}}>\n        {{#if new_value}}\n          {{#with new_value}}\n            {{partial \"admin/templates/logs/site_customization_change_details\"}}\n          {{/with}}\n        {{else}}\n          {{i18n admin.logs.staff_actions.deleted}}\n        {{/if}}\n      </div>\n      <div {{bind-attr class=\":modal-tab :previous-tab previousSelected::invisible\"}}>\n        {{#if previous_value}}\n          {{#with previous_value}}\n            {{partial \"admin/templates/logs/site_customization_change_details\"}}\n          {{/with}}\n        {{else}}\n          {{i18n admin.logs.staff_actions.no_previous}}\n        {{/if}}\n      </div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class='btn btn-primary' {{action closeModal}}>{{i18n close}}</button>\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/logs/staff_action_logs"] = Ember.Handlebars.compile("<div class=\"staff-action-logs-controls\">\n    <a {{action clearAllFilters}} {{bind-attr class=\":clear-filters :filter filtersExists::invisible\"}}>\n      <span class=\"label\">{{i18n admin.logs.staff_actions.clear_filters}}</span>\n    </a>\n    {{#if actionFilter}}\n      <a {{action clearFilter \"action_name\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.action}}</span>: {{actionFilter}}\n        <i class=\"fa fa-times-circle\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.acting_user}}\n      <a {{action clearFilter \"acting_user\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.staff_user}}</span>: {{filters.acting_user}}\n        <i class=\"fa fa-times-circle\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.target_user}}\n      <a {{action clearFilter \"target_user\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.target_user}}</span>: {{filters.target_user}}\n        <i class=\"fa fa-times-circle\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.subject}}\n      <a {{action clearFilter \"subject\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.subject}}</span>: {{filters.subject}}\n        <i class=\"fa fa-times-circle\"></i>\n      </a>\n    {{/if}}\n  </div>\n  \n  <div class=\"staff-action-logs-instructions\" {{bind-attr class=\":staff-action-logs-instructions showInstructions::invisible\"}}>\n    {{i18n admin.logs.staff_actions.instructions}}\n  </div>\n  \n  <div class='table staff-actions'>\n    <div class=\"heading-container\">\n      <div class=\"col heading first staff_user\">{{i18n admin.logs.staff_actions.staff_user}}</div>\n      <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n      <div class=\"col heading subject\">{{i18n admin.logs.staff_actions.subject}}</div>\n      <div class=\"col heading created_at\">{{i18n admin.logs.staff_actions.when}}</div>\n      <div class=\"col heading details\">{{i18n admin.logs.staff_actions.details}}</div>\n      <div class=\"col heading context\">{{i18n admin.logs.staff_actions.context}}</div>\n      <div class=\"clearfix\"></div>\n    </div>\n  \n    {{#if loading}}\n      <br/>\n      <div class='admin-loading'>{{i18n loading}}</div>\n    {{else}}\n      {{#if model.length}}\n        {{view Discourse.StaffActionLogsListView contentBinding=\"controller\"}}\n      {{else}}\n        {{i18n search.no_results}}\n      {{/if}}\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/logs/staff_action_logs_list_item"] = Ember.Handlebars.compile("<div class=\"col value first staff_user\">\n    {{#link-to 'adminUser' acting_user}}{{avatar acting_user imageSize=\"tiny\"}}{{/link-to}}\n    <a {{action filterByStaffUser acting_user}} class=\"btn btn-small\">{{acting_user.username}}</a>\n  </div>\n  <div class=\"col value action\">\n    <a {{action filterByAction action_name}} class=\"btn btn-small\">{{actionName}}</a>\n  </div>\n  <div class=\"col value subject\">\n    {{#if target_user}}\n      {{#link-to 'adminUser' target_user}}{{avatar target_user imageSize=\"tiny\"}}{{/link-to}}\n      <a {{action filterByTargetUser target_user}} class=\"btn btn-small\">{{target_user.username}}</a>\n    {{/if}}\n    {{#if subject}}\n      <a {{action filterBySubject subject}} {{bind-attr title=\"subject\"}}  class=\"btn btn-small\">{{subject}}</a>\n    {{/if}}\n  </div>\n  <div class=\"col value created_at\">{{age-with-tooltip created_at}}</div>\n  <div class=\"col value details\">\n    {{{formattedDetails}}}\n    {{#if useCustomModalForDetails}}\n      <a {{action showCustomDetailsModal this}}>{{i18n admin.logs.staff_actions.show}}</a>\n    {{/if}}\n    {{#if useModalForDetails}}\n      <a {{action showDetailsModal this}}>{{i18n admin.logs.staff_actions.show}}</a>\n    {{/if}}\n  </div>\n  <div class=\"col value context\">{{context}}</div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/modal/admin_agree_flag"] = Ember.Handlebars.compile("{{#unless postHidden}}\n    <button title=\"{{i18n admin.flags.agree_flag_hide_post_title}}\" {{action agreeFlagHidePost}} class=\"btn\"><i class=\"fa fa-thumbs-o-up\"></i><i class=\"fa fa-eye-slash\"></i>{{i18n admin.flags.agree_flag_hide_post}}</button>\n  {{/unless}}\n  <button title=\"{{i18n admin.flags.agree_flag_title}}\" {{action agreeFlagKeepPost}} class=\"btn\"><i class=\"fa fa-thumbs-o-up\"></i>{{i18n admin.flags.agree_flag}}</button>\n  {{#if canDeleteAsSpammer}}\n    <button title=\"{{i18n admin.flags.delete_spammer_title}}\" {{action deleteSpammer user}} class=\"btn btn-danger\"><i class=\"fa fa-exclamation-triangle\"></i>{{i18n admin.flags.delete_spammer}}</button>\n  {{/if}}");
Ember.TEMPLATES["admin/templates/modal/admin_badge_preview"] = Ember.Handlebars.compile("<div class=\"badge-query-preview\">\n    {{#if errors}}\n      <p class=\"error-header\">{{i18n admin.badges.preview.sql_error_header}}</p>\n  \n      <pre class=\"badge-errors\">{{errors}}</pre>\n  \n      <!--\n      TODO we want some help pages for this, link to those instead\n      <p>\n        {{i18n admin.badges.preview.error_help}}\n      </p>\n      <ul>\n        <li><a href=\"https://meta.discourse.org/t/triggered-custom-badge-queries/19336\">https://meta.discourse.org/t/triggered-custom-badge-queries/19336</a></li>\n      </ul>\n      -->\n    {{else}}\n      <p class=\"grant-count\">{{{i18n admin.badges.preview.grant_count count=count}}}</p>\n  \n      {{#if count_warning}}\n        <div class=\"count-warning\">\n          <p class=\"heading\"><i class=\"fa fa-warning\"></i> {{i18n admin.badges.preview.bad_count_warning.header}}</p>\n          <p class=\"body\">{{i18n admin.badges.preview.bad_count_warning.text}}</p>\n        </div>\n      {{/if}}\n  \n      {{#if sample}}\n        <p class=\"sample\">\n          {{i18n admin.badges.preview.sample}}\n        </p>\n        <ul>\n          {{#each html in processed_sample}}\n            <li>{{{html}}}</li>\n          {{/each}}\n        </ul>\n      {{/if}}\n  \n      {{#if has_query_plan}}\n          <div class=\"badge-query-plan\">\n            {{{query_plan_html}}}\n          </div>\n      {{/if}}\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/modal/admin_delete_flag"] = Ember.Handlebars.compile("<button title=\"{{i18n admin.flags.delete_post_defer_flag_title}}\" {{action deletePostDeferFlag}} class=\"btn\"><i class=\"fa fa-trash-o\"></i><i class=\"fa fa-external-link\"></i>{{i18n admin.flags.delete_post_defer_flag}}</button>\n  <button title=\"{{i18n admin.flags.delete_post_agree_flag_title}}\" {{action deletePostAgreeFlag}} class=\"btn\"><i class=\"fa fa-trash-o\"></i><i class=\"fa fa-thumbs-o-up\"></i>{{i18n admin.flags.delete_post_agree_flag}}</button>\n  {{#if canDeleteAsSpammer}}\n    <button title=\"{{i18n admin.flags.delete_spammer_title}}\" {{action deleteSpammer user}} class=\"btn btn-danger\"><i class=\"fa fa-exclamation-triangle\"></i>{{i18n admin.flags.delete_spammer}}</button>\n  {{/if}}");
Ember.TEMPLATES["admin/templates/modal/admin_edit_badge_groupings"] = Ember.Handlebars.compile("<div class=\"modal-body\">\n    <div>\n      <ul class='badge-groupings'>\n      {{#each workingCopy}}\n      <li>\n      {{#if editing}}\n        {{input value=this.name}}\n        <button {{action save this}}><i class=\"fa fa-check\"></i></button>\n      {{else}}\n        {{this.name}}\n      {{/if}}\n      <div class='actions'>\n      <button {{action edit this}}><i class=\"fa fa-pencil\"></i></button>\n      <button {{action up this}}><i class=\"fa fa-toggle-up\"></i></button>\n      <button {{action down this}}><i class=\"fa fa-toggle-down\"></i></button>\n      <button {{action delete this}}><i class=\"fa fa-times\"></i></button>\n      </div>\n      </li>\n      {{/each}}\n      </ul>\n    </div>\n    <button class='btn' {{action add}}>{{i18n admin.badges.new}}</button>\n  </div>\n  <div class=\"modal-footer\">\n    <button class='btn btn-primary' {{action saveAll}} {{bind-attr disabled=\"submitDisabled\"}}>{{i18n admin.badges.save}}</button>\n    <a {{action cancel}}>{{i18n cancel}}</a>\n  </div>");
Ember.TEMPLATES["admin/templates/modal/admin_start_backup"] = Ember.Handlebars.compile("<button {{action startBackup}} class=\"btn btn-primary\">{{i18n yes_value}}</button>\n  <button {{action startBackupWithoutUpload}} class=\"btn\">{{i18n admin.backups.operations.backup.without_uploads}}</button>\n  <button {{action cancel}} class=\"btn\">{{i18n no_value}}</button>");
Ember.TEMPLATES["admin/templates/modal/admin_suspend_user"] = Ember.Handlebars.compile("<div class=\"modal-body\">\n    <form>\n      {{i18n admin.user.suspend_duration}}\n      {{text-field value=duration maxlength=\"5\" autofocus=\"autofocus\"}}\n      {{i18n admin.user.suspend_duration_units}}<br/>\n      <br/>\n      {{{i18n admin.user.suspend_reason_label}}}<br/>\n      <br/>\n      {{text-field value=reason class=\"span8\"}}\n    </form>\n  </div>\n  <div class=\"modal-footer\">\n    <button class='btn btn-danger' {{action suspend}} {{bind-attr disabled=\"submitDisabled\"}}><i class='fa fa-ban'></i>{{i18n admin.user.suspend}}</button>\n    <a {{action closeModal}}>{{i18n cancel}}</a>\n  </div>");
Ember.TEMPLATES["admin/templates/reports"] = Ember.Handlebars.compile("{{#if loaded}}\n    <h3>{{title}}</h3>\n  \n    <button class='btn'\n            {{action viewAsTable}}\n            {{bind-attr disabled=\"viewingTable\"}}>{{i18n admin.dashboard.reports.view_table}}</button>\n  \n    <button class='btn'\n            {{action viewAsBarChart}}\n            {{bind-attr disabled=\"viewingBarChart\"}}>{{i18n admin.dashboard.reports.view_chart}}</button>\n  \n    <table class='table report'>\n      <tr>\n        <th>{{xaxis}}</th>\n        <th>{{yaxis}}</th>\n      </tr>\n  \n      {{#each row in dataReversed}}\n        <tr>\n          <td>{{row.x}}</td>\n          <td>\n            {{#if viewingTable}}\n              {{row.y}}\n            {{/if}}\n            {{#if viewingBarChart}}\n              <div class='bar-container'>\n                <div class='bar' style=\"width: {{unbound row.percentage}}%\">{{row.y}}</div>\n              </div>\n            {{/if}}\n          </td>\n        </tr>\n      {{/each}}\n    </table>\n  \n  {{else}}\n    {{i18n loading}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/reports/per_day_counts_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\"><a {{bind-attr href=\"reportUrl\"}}>{{title}}</a></td>\n    <td class=\"value\">{{todayCount}}</td>\n    <td class=\"value\">{{yesterdayCount}}</td>\n    <td class=\"value\">{{sevenDaysAgoCount}}</td>\n    <td class=\"value\">{{thirtyDaysAgoCount}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/reports/summed_counts_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\">\n      {{#if icon}}\n        <i {{bind-attr class=\":fa icon\"}}></i>\n      {{/if}}\n      <a {{bind-attr href=\"reportUrl\"}}>{{title}}</a>\n    </td>\n    <td class=\"value\">{{todayCount}}</td>\n    <td {{bind-attr class=\":value yesterdayTrend\"}} {{bind-attr title=\"yesterdayCountTitle\"}}>{{yesterdayCount}} <i class=\"fa up fa-caret-up\"></i><i class=\"fa down fa-caret-down\"></i></td>\n    <td {{bind-attr class=\":value sevenDayTrend\"}} {{bind-attr title=\"sevenDayCountTitle\"}}>{{lastSevenDaysCount}} <i class=\"fa up fa-caret-up\"></i><i class=\"fa down fa-caret-down\"></i></td>\n    <td {{bind-attr class=\":value thirtyDayTrend\"}} {{bind-attr title=\"thirtyDayCountTitle\"}}>{{lastThirtyDaysCount}} <i class=\"fa up fa-caret-up\"></i><i class=\"fa down fa-caret-down\"></i></td>\n    <td class=\"value\">{{total}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/reports/trust_levels_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\">{{title}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.newuser'}}{{valueAtTrustLevel data 0}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.basicuser'}}{{valueAtTrustLevel data 1}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.regular'}}{{valueAtTrustLevel data 2}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.leaders'}}{{valueAtTrustLevel data 3}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.elders'}}{{valueAtTrustLevel data 4}}{{/link-to}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/site_content_edit"] = Ember.Handlebars.compile("<h3>{{model.title}}</h3>\n  <p class='description'>{{model.description}}</p>\n  \n  {{#if model.markdown}}\n    {{pagedown-editor value=model.content}}\n  {{/if}}\n  {{#if model.plainText}}\n    {{textarea value=model.content class=\"plain\"}}\n  {{/if}}\n  {{#if model.html}}\n    {{aceEditor content=model.content mode=\"html\"}}\n  {{/if}}\n  {{#if model.css}}\n    {{aceEditor content=model.content mode=\"css\"}}\n  {{/if}}\n  \n  <div class='controls'>\n    <button class='btn' {{action saveChanges}} {{bind-attr disabled=\"saveDisabled\"}}>\n      {{#if saving}}\n        {{i18n saving}}\n      {{else}}\n        {{i18n save}}\n      {{/if}}\n    </button>\n    {{#if saved}}{{i18n saved}}{{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/site_contents"] = Ember.Handlebars.compile("<div class='row'>\n    <div class='content-list span6'>\n      <h3>{{i18n admin.site_content.edit}}</h3>\n      <ul>\n        {{#each type in model}}\n          <li>\n            {{#link-to 'adminSiteContentEdit' type}}{{type.title}}{{/link-to}}\n          </li>\n        {{/each}}\n      </ul>\n    </div>\n  \n    <div class='content-editor'>\n      {{outlet}}\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/site_contents_empty"] = Ember.Handlebars.compile("<p>{{i18n admin.site_content.none}}</p>");
Ember.TEMPLATES["admin/templates/site_settings"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='search controls'>\n      <label>\n        {{input type=\"checkbox\" checked=onlyOverridden}}\n        {{i18n admin.site_settings.show_overriden}}\n      </label>\n    </div>\n    <div class='controls'>\n      {{text-field value=filter placeholderKey=\"type_to_filter\"}}\n      <button {{action clearFilter}} class=\"btn\">{{i18n admin.site_settings.clear_filter}}</button>\n    </div>\n  </div>\n  \n  <div class=\"site-settings-nav pull-left\">\n    <ul class=\"nav nav-stacked\">\n      {{#each category in controller}}\n        <li {{bind-attr class=\"category.nameKey\"}}>\n          {{#link-to 'adminSiteSettingsCategory' category.nameKey class=category.nameKey}}\n            {{category.name}}\n            {{#if filtered}}\n              <span class=\"count\">({{category.siteSettings.length}})</span>\n            {{/if}}\n            <span class='fa fa-chevron-right'></span>\n          {{/link-to}}\n        </li>\n      {{/each}}\n    </ul>\n  </div>\n  \n  <div class=\"site-settings-detail pull-left\">\n    {{ outlet }}\n  </div>\n  \n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/site_settings/setting_bool"] = Ember.Handlebars.compile("<div class='setting-label'>\n    <h3>{{unbound settingName}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    <label>\n      {{view Ember.Checkbox checkedBinding=\"enabled\" value=\"true\"}}\n      {{unbound description}}\n    </label>\n  </div>\n  {{#if dirty}}\n    <div class='setting-controls'>\n      <button class='btn ok no-text' {{action save this}}><i class='fa fa-check'></i></button>\n      <button class='btn cancel no-text' {{action cancel this}}><i class='fa fa-times'></i></button>\n    </div>\n  {{else}}\n    {{#if overridden}}\n      <button class='btn' href='#' {{action resetDefault this}}><i class=\"fa fa-undo\"></i>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings/setting_enum"] = Ember.Handlebars.compile("<div class='setting-label'>\n     <h3>{{unbound settingName}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    {{combo-box valueAttribute=\"value\" content=validValues value=value none=allowsNone}}\n    <div class='desc'>{{unbound description}}</div>\n  </div>\n  {{#if dirty}}\n    <div class='setting-controls'>\n      <button class='btn ok no-text' {{action save this}}><i class='fa fa-check'></i></button>\n      <button class='btn cancel no-text' {{action cancel this}}><i class='fa fa-times'></i></button>\n    </div>\n  {{else}}\n    {{#if overridden}}\n      <button class='btn' href='#' {{action resetDefault this}}><i class=\"fa fa-undo\"></i>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings/setting_list"] = Ember.Handlebars.compile("<div class='setting-label'>\n      <h3>{{unbound settingName}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    {{list-setting settingValue=value choices=choices settingName=setting}}\n      <div class='desc'>{{unbound description}}</div>\n  </div>\n  {{#if dirty}}\n      <div class='setting-controls'>\n          <button class='btn ok no-text' {{action save this}}><i class='fa fa-check'></i></button>\n          <button class='btn cancel no-text' {{action cancel this}}><i class='fa fa-times'></i></button>\n      </div>\n  {{else}}\n    {{#if overridden}}\n        <button class='btn' href='#' {{action resetDefault this}}><i class=\"fa fa-undo\"></i>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings/setting_string"] = Ember.Handlebars.compile("<div class='setting-label'>\n     <h3>{{unbound settingName}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    {{text-field value=value classNames=\"input-setting-string\"}}\n    <div {{bind-attr class=\":validation-error validationMessage::hidden\"}}><i class='fa fa-times'></i> {{validationMessage}}</div>\n    <div class='desc'>{{unbound description}}</div>\n  </div>\n  {{#if dirty}}\n    <div class='setting-controls'>\n      <button class='btn ok no-text' {{action save this}}><i class='fa fa-check'></i></button>\n      <button class='btn cancel no-text' {{action cancel this}}><i class='fa fa-times'></i></button>\n    </div>\n  {{else}}\n    {{#if overridden}}\n      <button class='btn' href='#' {{action resetDefault this}}><i class=\"fa fa-undo\"></i>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings_category"] = Ember.Handlebars.compile("{{#if filteredContent.length}}\n    {{collection contentBinding=\"filteredContent\" classNames=\"form-horizontal settings\" itemViewClass=\"Discourse.SiteSettingView\"}}\n  {{else}}\n    <br/>\n    {{i18n admin.site_settings.no_results}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/user"] = Ember.Handlebars.compile("{{outlet}}");
Ember.TEMPLATES["admin/templates/user_badges"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class='nav nav-pills'>\n        <li>{{#link-to 'adminUser' user}}<i class=\"fa fa-caret-left\"></i> &nbsp;{{user.username}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  {{#if loading}}\n    <div class='spinner'>{{i18n loading}}</div>\n  {{else}}\n    <div class='admin-container user-badges'>\n      <h2>{{i18n admin.badges.grant_badge}}</h2>\n      {{#if noBadges}}\n        <p>{{i18n admin.badges.no_badges}}</p>\n      {{else}}\n        <br>\n        {{combo-box valueAttribute=\"id\" value=controller.selectedBadgeId content=controller.grantableBadges}}\n        <button class='btn btn-primary' {{action grantBadge controller.selectedBadgeId}}>{{i18n admin.badges.grant}}</button>\n      {{/if}}\n  \n      <br>\n      <br>\n  \n      <h2>{{i18n admin.badges.granted_badges}}</h2>\n      <br>\n  \n      <table>\n        <tr>\n          <th>{{i18n admin.badges.badge}}</th>\n          <th>{{i18n admin.badges.granted_by}}</th>\n          <th>{{i18n admin.badges.granted_at}}</th>\n          <th></th>\n        </tr>\n  \n        {{#each}}\n          <tr>\n            <td>{{user-badge badge=badge}}</td>\n            <td>\n              {{#link-to 'adminUser' badge.granted_by}}\n                {{avatar granted_by imageSize=\"tiny\"}}\n                {{granted_by.username}}\n              {{/link-to}}\n            </td>\n            <td>{{age-with-tooltip granted_at}}</td>\n            <td>\n              <button class='btn' {{action revokeBadge this}}>{{i18n admin.badges.revoke}}</button>\n            </td>\n          </tr>\n        {{else}}\n          <tr>\n            <td colspan=\"5\">\n              <p>{{i18n admin.badges.no_user_badges name=user.username}}</p>\n            </td>\n          </tr>\n        {{/each}}\n      </table>\n    </div>\n  {{/if}}");
Ember.TEMPLATES["admin/templates/user_index"] = Ember.Handlebars.compile("<section {{bind-attr class=\":details active::not-activated\"}}>\n  \n    <div class='user-controls'>\n      {{#if active}}\n        {{#link-to 'user' model class=\"btn\"}}\n          <i class='fa fa-user'></i>\n          {{i18n admin.user.show_public_profile}}\n        {{/link-to}}\n        {{#if can_impersonate}}\n            <button class='btn btn-danger' {{action impersonate target=\"content\"}} title=\"{{i18n admin.impersonate.help}}\">\n              <i class='fa fa-crosshairs'></i>\n              {{i18n admin.impersonate.title}}\n            </button>\n        {{/if}}\n        {{#if currentUser.admin}}\n        <button class='btn' {{action log_out target=\"content\"}}>\n          <i class='fa fa-power-off'></i>\n          {{i18n admin.user.log_out}}\n        </button>\n        {{/if}}\n      {{/if}}\n    </div>\n  \n    <div class='display-row username'>\n      <div class='field'>{{i18n user.username.title}}</div>\n      <div class='value'>{{username}}</div>\n      <div class='controls'>\n        {{#link-to 'preferences.username' model class=\"btn\"}}\n          <i class='fa fa-pencil'></i>\n          {{i18n user.change_username.title}}\n        {{/link-to}}\n      </div>\n    </div>\n  \n    <div class='display-row email'>\n      <div class='field'>{{i18n user.email.title}}</div>\n      <div class='value'><a href=\"mailto:{{unbound email}}\">{{email}}</a></div>\n      <div class='controls'>{{i18n admin.users.not_verified}}</div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.avatar.title}}</div>\n      <div class='value'>{{avatar content imageSize=\"large\"}}</div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.title.title}}</div>\n      <div class='value'>\n        {{#if editingTitle}}\n          {{text-field value=title autofocus=\"autofocus\"}}\n        {{else}}\n          <span {{action toggleTitleEdit}}>{{title}}&nbsp;</span>\n        {{/if}}\n      </div>\n      <div class='controls'>\n        {{#if editingTitle}}\n          <button class='btn' {{action saveTitle}}>{{i18n admin.user.save_title}}</button>\n          <a href=\"#\" {{action toggleTitleEdit}}>{{i18n cancel}}</a>\n        {{else}}\n          <button class='btn' {{action toggleTitleEdit}}><i class=\"fa fa-pencil\"></i>{{i18n admin.user.edit_title}}</button>\n        {{/if}}\n      </div>\n    </div>\n  \n  \n    {{#if currentUser.admin}}\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.groups.title}}</div>\n      <div class='value'>\n        {{admin-group-selector selected=model.groups available=availableGroups}}\n      </div>\n      <div class='controls'>\n        {{#if custom_groups}}\n          {{i18n admin.groups.primary}}\n          {{combo-box content=custom_groups value=primary_group_id nameProperty=\"name\" none=\"admin.groups.no_primary\"}}\n        {{/if}}\n        {{#if primaryGroupDirty}}\n          <button class='btn ok no-text' {{action savePrimaryGroup}}><i class='fa fa-check'></i></button>\n          <button class='btn cancel no-text' {{action resetPrimaryGroup}}><i class='fa fa-times'></i></button>\n        {{/if}}\n      </div>\n    </div>\n    {{/if}}\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.ip_address.title}}</div>\n      <div class='value'>{{ip_address}}</div>\n      <div class='controls'>\n        {{#if currentUser.admin}}\n          <button class='btn' {{action refreshBrowsers target=\"content\"}}>\n            {{i18n admin.user.refresh_browsers}}\n          </button>\n          {{ip-lookup ip=ip_address user_id=id}}\n        {{/if}}\n      </div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.registration_ip_address.title}}</div>\n      <div class='value'>{{registration_ip_address}}</div>\n      <div class='controls'>\n        {{#if currentUser.admin}}\n          {{ip-lookup ip=registration_ip_address user_id=id}}\n        {{/if}}\n      </div>\n    </div>\n  \n    {{#if showBadges}}\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.badges.title}}</div>\n        <div class='value'>\n          {{i18n badges.badge_count count=badge_count}}\n        </div>\n        <div class='controls'>\n          {{#link-to 'adminUser.badges' this class=\"btn\"}}<i class=\"fa fa-certificate\"></i>{{i18n admin.badges.edit_badges}}{{/link-to}}\n        </div>\n      </div>\n    {{/if}}\n  \n  </section>\n  \n  \n  <section class='details'>\n    <h1>{{i18n admin.user.permissions}}</h1>\n  \n    {{#if showApproval}}\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.users.approved}}</div>\n        <div class='value'>\n          {{#if approved}}\n            {{i18n admin.user.approved_by}}\n  \n            {{#link-to 'adminUser' approvedBy}}{{avatar approvedBy imageSize=\"small\"}}{{/link-to}}\n            {{#link-to 'adminUser' approvedBy}}{{approvedBy.username}}{{/link-to}}\n          {{else}}\n            {{i18n no_value}}\n          {{/if}}\n  \n        </div>\n        <div class='controls'>\n          {{#if approved}}\n            {{i18n admin.user.approve_success}}\n          {{else}}\n            {{#if can_approve}}\n              <button class='btn' {{action approve target=\"content\"}}>\n                <i class='fa fa-check'></i>\n                {{i18n admin.user.approve}}\n              </button>\n            {{/if}}\n          {{/if}}\n        </div>\n      </div>\n    {{/if}}\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.users.active}}</div>\n      <div class='value'>\n        {{#if active}}\n          {{i18n yes_value}}\n        {{else}}\n          {{i18n no_value}}\n        {{/if}}\n      </div>\n      <div class='controls'>\n        {{#if active}}\n          {{#if can_deactivate}}\n            <button class='btn' {{action deactivate target=\"content\"}}>{{i18n admin.user.deactivate_account}}</button>\n            {{i18n admin.user.deactivate_explanation}}\n          {{/if}}\n        {{else}}\n          {{#if can_send_activation_email}}\n            <button class='btn' {{action sendActivationEmail target=\"content\"}}>\n              <i class='fa fa-envelope'></i>\n              {{i18n admin.user.send_activation_email}}\n            </button>\n          {{/if}}\n          {{#if can_activate}}\n            <button class='btn' {{action activate target=\"content\"}}>\n              <i class='fa fa-check'></i>\n              {{i18n admin.user.activate}}\n            </button>\n          {{/if}}\n        {{/if}}\n      </div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.api.key}}</div>\n  \n      {{#if api_key}}\n        <div class='long-value'>\n          {{api_key.key}}\n          <button class='btn' {{action regenerateApiKey}}><i class=\"fa fa-undo\"></i>{{i18n admin.api.regenerate}}</button>\n          <button {{action revokeApiKey}} class=\"btn\"><i class=\"fa fa-times\"></i>{{i18n admin.api.revoke}}</button>\n        </div>\n      {{else}}\n        <div class='value'>\n        &mdash;\n        </div>\n        <div class='controls'>\n          <button {{action generateApiKey}} class=\"btn\"><i class=\"fa fa-key\"></i>{{i18n admin.api.generate}}</button>\n        </div>\n      {{/if}}\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.admin}}</div>\n      <div class='value'>{{admin}}</div>\n      <div class='controls'>\n        {{#if can_revoke_admin}}\n          <button class='btn' {{action revokeAdmin target=\"content\"}}>\n            <i class='fa fa-shield'></i>\n            {{i18n admin.user.revoke_admin}}\n          </button>\n        {{/if}}\n        {{#if can_grant_admin}}\n          <button class='btn' {{action grantAdmin target=\"content\"}}>\n            <i class='fa fa-shield'></i>\n            {{i18n admin.user.grant_admin}}\n          </button>\n        {{/if}}\n      </div>\n  \n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.moderator}}</div>\n      <div class='value'>{{moderator}}</div>\n      <div class='controls'>\n        {{#if can_revoke_moderation}}\n          <button class='btn' {{action revokeModeration target=\"content\"}}>\n            <i class='fa fa-shield'></i>\n            {{i18n admin.user.revoke_moderation}}\n          </button>\n        {{/if}}\n        {{#if can_grant_moderation}}\n          <button class='btn' {{action grantModeration target=\"content\"}}>\n            <i class='fa fa-shield'></i>\n            {{i18n admin.user.grant_moderation}}\n          </button>\n        {{/if}}\n      </div>\n  \n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n trust_level}}</div>\n      <div class=\"value\">\n        {{combo-box content=trustLevels value=trust_level nameProperty=\"detailedName\"}}\n      </div>\n      <div class=\"controls\">\n        {{#if leaderRequirements}}\n          {{#link-to 'adminUser.leaderRequirements' this class=\"btn\"}}{{i18n admin.user.trust_level_3_requirements}}{{/link-to}}\n        {{/if}}\n  \n        {{#if dirty}}\n          <div>\n          <button class='btn ok no-text' {{action saveTrustLevel target=\"content\"}}><i class='fa fa-check'></i></button>\n          <button class='btn cancel no-text' {{action restoreTrustLevel target=\"content\"}}><i class='fa fa-times'></i></button>\n          </div>\n        {{/if}}\n      </div>\n    </div>\n  \n    <div {{bind-attr class=\":display-row isSuspended:highlight-danger\"}}>\n      <div class='field'>{{i18n admin.user.suspended}}</div>\n      <div class='value'>{{isSuspended}}</div>\n      <div class='controls'>\n      {{#if isSuspended}}\n        <button class='btn btn-danger' {{action unsuspend target=\"content\"}}>\n          <i class='fa fa-ban'></i>\n          {{i18n admin.user.unsuspend}}\n        </button>\n        {{suspendDuration}}\n        {{i18n admin.user.suspended_explanation}}\n      {{else}}\n        {{#if canSuspend}}\n          <button class='btn btn-danger' {{action showSuspendModal this}}>\n            <i class='fa fa-ban'></i>\n            {{i18n admin.user.suspend}}\n          </button>\n          {{i18n admin.user.suspended_explanation}}\n        {{/if}}\n      {{/if}}\n      </div>\n    </div>\n  \n    {{#if isSuspended}}\n    <div class='display-row highlight-danger'>\n      <div class='field'>{{i18n admin.user.suspended_by}}</div>\n      <div class='value'>\n        {{#link-to 'adminUser' suspendedBy}}{{avatar suspendedBy imageSize=\"tiny\"}}{{/link-to}}\n        {{#link-to 'adminUser' suspendedBy}}{{suspendedBy.username}}{{/link-to}}\n      </div>\n      <div class='controls'>\n        <b>{{i18n admin.user.suspend_reason}}</b>:\n        {{suspend_reason}}\n      </div>\n    </div>\n    {{/if}}\n  \n    <div class='display-row' {{bind-attr class=\":display-row blocked:highlight-danger\"}}>\n      <div class='field'>{{i18n admin.user.blocked}}</div>\n      <div class='value'>{{blocked}}</div>\n      <div class='controls'>\n        {{#if blocked}}\n          <button class='btn' {{action unblock target=\"content\"}}>\n            <i class='fa fa-thumbs-o-up'></i>\n            {{i18n admin.user.unblock}}\n          </button>\n          {{i18n admin.user.block_explanation}}\n        {{/if}}\n      </div>\n    </div>\n  </section>\n  \n  <section class='details'>\n    <h1>{{i18n admin.user.activity}}</h1>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n created}}</div>\n      <div class='value'>{{{created_at_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.users.last_emailed}}</div>\n      <div class='value'>{{{last_emailed_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n last_seen}}</div>\n      <div class='value'>{{{last_seen_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.like_count}}</div>\n      <div class='value'>{{like_given_count}} / {{like_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.topics_entered}}</div>\n      <div class='value'>{{topics_entered}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.post_count}}</div>\n      <div class='value'>{{post_count}}</div>\n      <div class='controls'>\n        {{#if can_delete_all_posts}}\n          <button class='btn btn-danger' {{action deleteAllPosts target=\"content\"}}>\n            <i class='fa fa-trash-o'></i>\n            {{i18n admin.user.delete_all_posts}}\n          </button>\n        {{else}}\n          {{deleteAllPostsExplanation}}\n        {{/if}}\n      </div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.posts_read_count}}</div>\n      <div class='value'>{{posts_read_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.flags_given_received_count}}</div>\n      <div class='value'>{{flags_given_count}} / {{flags_received_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.private_topics_count}}</div>\n      <div class='value'>{{private_topics_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.time_read}}</div>\n      <div class='value'>{{{time_read}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n user.invited.days_visited}}</div>\n      <div class='value'>{{{days_visited}}}</div>\n    </div>\n  </section>\n  \n  {{#if single_sign_on_record}}\n  <section class='details'>\n    <h1>{{i18n admin.user.sso.title}}</h1>\n  \n    {{#with single_sign_on_record}}\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.user.sso.external_id}}</div>\n        <div class='value'>{{external_id}}</div>\n      </div>\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.user.sso.external_username}}</div>\n        <div class='value'>{{external_username}}</div>\n      </div>\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.user.sso.external_name}}</div>\n        <div class='value'>{{external_name}}</div>\n      </div>\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.user.sso.external_email}}</div>\n        <div class='value'>{{external_email}}</div>\n      </div>\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.user.sso.external_avatar_url}}</div>\n        <div class='value'>{{external_avatar_url}}</div>\n      </div>\n    {{/with}}\n  </section>\n  {{/if}}\n  \n  <section>\n    <hr/>\n    <button {{bind-attr class=\":btn :btn-danger :pull-right deleteForbidden:hidden\"}} {{action destroy target=\"content\"}} {{bind-attr disabled=\"deleteForbidden\"}}>\n      <i class=\"fa fa-exclamation-triangle\"></i>\n      {{i18n admin.user.delete}}\n    </button>\n    {{#if deleteExplanation}}\n      <div class=\"clearfix\"></div>\n      <div class=\"pull-right\"><i class=\"fa fa-exclamation-triangle\"></i> {{deleteExplanation}}</div>\n    {{/if}}\n  </section>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/user_leader_requirements"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminUser' this}}<i class=\"fa fa-caret-left\"></i> &nbsp;{{username}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.regular'}}{{i18n admin.user.trust_level_2_users}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  <div class=\"admin-container leader-requirements\">\n    <h2>{{username}} - {{i18n admin.user.tl3_requirements.title}}</h2>\n    <br/>\n    <p>{{i18n admin.user.tl3_requirements.table_title}}</p>\n  \n    {{#with leaderRequirements}}\n      <table class=\"table\" style=\"width: 50%;\">\n        <thead>\n          <tr>\n            <th></th>\n            <th></th>\n            <th>{{i18n admin.user.tl3_requirements.value_heading}}</th>\n            <th>{{i18n admin.user.tl3_requirements.requirement_heading}}</th>\n          </tr>\n        </thead>\n        <tbody>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.visits}}</th>\n            <td><i {{bind-attr class=\":fa met.days_visited:fa-check:fa-times\"}}></i></td>\n            <td>\n              {{days_visited_percent}}% ({{days_visited}} / {{time_period}} {{i18n admin.user.tl3_requirements.days}})\n            </td>\n            <td>{{min_days_visited_percent}}%</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.topics_replied_to}}</th>\n            <td><i {{bind-attr class=\":fa met.topics_replied_to:fa-check:fa-times\"}}></i></td>\n            <td>{{num_topics_replied_to}}</td>\n            <td>{{min_topics_replied_to}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.topics_viewed}}</th>\n            <td><i {{bind-attr class=\":fa met.topics_viewed:fa-check:fa-times\"}}></i></td>\n            <td>{{topics_viewed}}</td>\n            <td>{{min_topics_viewed}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.topics_viewed_all_time}}</th>\n            <td><i {{bind-attr class=\":fa met.topics_viewed_all_time:fa-check:fa-times\"}}></i></td>\n            <td>{{topics_viewed_all_time}}</td>\n            <td>{{min_topics_viewed_all_time}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.posts_read}}</th>\n            <td><i {{bind-attr class=\":fa met.posts_read:fa-check:fa-times\"}}></i></td>\n            <td>{{posts_read}}</td>\n            <td>{{min_posts_read}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.posts_read_all_time}}</th>\n            <td><i {{bind-attr class=\":fa met.posts_read_all_time:fa-check:fa-times\"}}></i></td>\n            <td>{{posts_read_all_time}}</td>\n            <td>{{min_posts_read_all_time}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.flagged_posts}}</th>\n            <td><i {{bind-attr class=\":fa met.flagged_posts:fa-check:fa-times\"}}></i></td>\n            <td>{{num_flagged_posts}}</td>\n            <td>{{max_flagged_posts}} {{i18n max}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.flagged_by_users}}</th>\n            <td><i {{bind-attr class=\":fa met.flagged_by_users:fa-check:fa-times\"}}></i></td>\n            <td>{{num_flagged_by_users}}</td>\n            <td>{{max_flagged_by_users}} {{i18n max}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.likes_given}}</th>\n            <td><i {{bind-attr class=\":fa met.likes_given:fa-check:fa-times\"}}></i></td>\n            <td>{{num_likes_given}}</td>\n            <td>{{min_likes_given}}</td>\n          </tr>\n          <tr>\n            <th>{{i18n admin.user.tl3_requirements.likes_received}}</th>\n            <td><i {{bind-attr class=\":fa met.likes_received:fa-check:fa-times\"}}></i></td>\n            <td>{{num_likes_received}}</td>\n            <td>{{min_likes_received}}</td>\n          </tr>\n        </tbody>\n      </table>\n    {{/with}}\n  \n    <br/>\n    <p>\n      {{#if leaderRequirements.requirements_met}}\n        <i class=\"fa fa-check\"></i> {{i18n admin.user.tl3_requirements.qualifies}}\n        {{#unless isLeader}}\n          {{i18n admin.user.tl3_requirements.will_be_promoted}}\n        {{/unless}}\n      {{else}}\n        <i class=\"fa fa-times\"></i> {{i18n admin.user.tl3_requirements.does_not_qualify}}\n        {{#if suspended}}\n          {{i18n user.suspended_notice date=\"suspendedTillDate\"}}\n        {{/if}}\n      {{/if}}\n    </p>\n  </div>");
Ember.TEMPLATES["admin/templates/users_list"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminUsersList.active'}}{{i18n admin.users.nav.active}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.new'}}{{i18n admin.users.nav.new}}{{/link-to}}</li>\n        {{#if Discourse.SiteSettings.must_approve_users}}\n          <li>{{#link-to 'adminUsersList.pending'}}{{i18n admin.users.nav.pending}}{{/link-to}}</li>\n        {{/if}}\n        <li>{{#link-to 'adminUsersList.admins'}}{{i18n admin.users.nav.admins}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.moderators'}}{{i18n admin.users.nav.moderators}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.suspended'}}{{i18n admin.users.nav.suspended}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.blocked'}}{{i18n admin.users.nav.blocked}}{{/link-to}}</li>\n      </ul>\n    </div>\n    <div class='username controls'>\n      {{text-field value=username placeholderKey=\"search_hint\"}}\n    </div>\n    <div class=\"pull-right\">\n      <button {{action exportUsers}} class=\"btn\" title=\"{{i18n admin.export_csv.users.title}}\"><i class=\"fa fa-download\"></i>{{i18n admin.export_csv.users.text}}</button>\n    </div>\n  </div>\n  \n  <div class=\"admin-container\">\n    {{#if hasSelection}}\n      <div id='selected-controls'>\n        <button {{action approveUsers}} class='btn'>{{countI18n admin.users.approved_selected countBinding=\"selectedCount\"}}</button>\n        <button {{action rejectUsers}}  class='btn btn-danger'>{{countI18n admin.users.reject_selected countBinding=\"selectedCount\"}}</button>\n      </div>\n    {{/if}}\n  \n    <h2>{{title}}</h2>\n    <br/>\n  \n    {{#if loading}}\n      <div class='admin-loading'>{{i18n loading}}</div>\n    {{else}}\n      {{#if model.length}}\n        <table class='table'>\n          <tr>\n            {{#if showApproval}}\n              <th>{{view Ember.Checkbox checkedBinding=\"selectAll\"}}</th>\n            {{/if}}\n            <th>&nbsp;</th>\n            <th>{{i18n username}}</th>\n            <th>{{i18n email}}</th>\n            <th>{{i18n admin.users.last_emailed}}</th>\n            <th>{{i18n last_seen}}</th>\n            <th>{{i18n admin.user.topics_entered}}</th>\n            <th>{{i18n admin.user.posts_read_count}}</th>\n            <th>{{i18n admin.user.time_read}}</th>\n            <th>{{i18n created}}</th>\n            {{#if showApproval}}\n              <th>{{i18n admin.users.approved}}</th>\n            {{/if}}\n            <th>&nbsp;</th>\n  \n          </tr>\n  \n          {{#each model}}\n            <tr {{bind-attr class=\"selected active::not-activated\"}}>\n              {{#if controller.showApproval}}\n                <td>\n                  {{#if can_approve}}\n                    {{view Ember.Checkbox checkedBinding=\"selected\"}}\n                  {{/if}}\n                </td>\n              {{/if}}\n              <td>{{#link-to 'adminUser' this}}{{avatar this imageSize=\"small\"}}{{/link-to}}</td>\n              <td>{{#link-to 'adminUser' this}}{{unbound username}}{{/link-to}}</td>\n              {{#if active}}\n                <td>{{shorten-text email}}</td>\n              {{else}}\n                <td title=\"{{i18n admin.users.not_verified}}\">{{shorten-text email}}</td>\n              {{/if}}\n              <td>{{{unbound last_emailed_age}}}</td>\n              <td>{{{unbound last_seen_age}}}</td>\n              <td>{{{unbound topics_entered}}}</td>\n              <td>{{{unbound posts_read_count}}}</td>\n              <td>{{{unbound time_read}}}</td>\n  \n              <td>{{{unbound created_at_age}}}</td>\n  \n              {{#if showApproval}}\n              <td>\n                {{#if approved}}\n                  {{i18n yes_value}}\n                {{else}}\n                  {{i18n no_value}}\n                {{/if}}\n              </td>\n              {{/if}}\n              <td>\n                {{#if admin}}<i class=\"fa fa-shield\" title=\"{{i18n admin.title}}\"></i>{{/if}}\n                {{#if moderator}}<i class=\"fa fa-shield\" title=\"{{i18n admin.moderator}}\"></i>{{/if}}\n              <td>\n            </tr>\n          {{/each}}\n  \n        </table>\n      {{else}}\n        <p>{{i18n search.no_results}}</p>\n      {{/if}}\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/version_checks"] = Ember.Handlebars.compile("<div {{bind-attr class=\":dashboard-stats :version-check versionCheck.critical_updates:critical:normal\"}}>\n        <table class=\"table table-condensed table-hover\">\n          <thead>\n            {{custom-html 'upgrade-header'}}\n            <tr>\n              <th>&nbsp;</th>\n              <th>{{i18n admin.dashboard.installed_version}}</th>\n              <th>{{i18n admin.dashboard.latest_version}}</th>\n              <th>&nbsp;</th>\n              <th>&nbsp;</th>\n            </tr>\n          </thead>\n          {{#unless loading}}\n            <tbody>\n              <td class=\"title\">{{i18n admin.dashboard.version}}</td>\n              <td class=\"version-number\"><a {{bind-attr href=\"versionCheck.gitLink\"}} target=\"_blank\">{{ versionCheck.installed_version }}</a></td>\n  \n              {{#if versionCheck.noCheckPerformed}}\n                <td class=\"version-number\">&nbsp;</td>\n                <td class=\"face\">\n                  <span class=\"icon critical-updates-available\">☹</span>\n                </td>\n                <td class=\"version-notes\">\n                  <span class=\"normal-note\">{{i18n admin.dashboard.no_check_performed}}</span>\n                </td>\n              {{else}}\n                {{#if versionCheck.staleData}}\n                  <td class=\"version-number\">{{#if versionCheck.version_check_pending}}{{ versionCheck.installed_version }}{{/if}}</td>\n                  <td class=\"face\">\n                    {{#if versionCheck.version_check_pending}}\n                      <span class='icon up-to-date'>☻</span>\n                    {{else}}\n                      <span class=\"icon critical-updates-available\">☹</span>\n                    {{/if}}\n                  </td>\n                  <td class=\"version-notes\">\n                    <span class=\"normal-note\">\n                      {{#if versionCheck.version_check_pending}}\n                        {{i18n admin.dashboard.version_check_pending}}\n                      {{else}}\n                        {{i18n admin.dashboard.stale_data}}\n                      {{/if}}\n                    </span>\n                  </td>\n                {{else}}\n                  <td class=\"version-number\">{{ versionCheck.latest_version }}</td>\n                  <td class=\"face\">\n                    {{#if versionCheck.upToDate }}\n                      <span class='icon up-to-date'>☻</span>\n                    {{else}}\n                      <span {{bind-attr class=\":icon versionCheck.critical_updates:critical-updates-available:updates-available\"}}>\n                        {{#if versionCheck.behindByOneVersion}}\n                          ☺\n                        {{else}}\n                          ☹\n                        {{/if}}\n                      </span>\n                    {{/if}}\n                  </td>\n                  <td class=\"version-notes\">\n                    {{#if versionCheck.upToDate }}\n                      {{i18n admin.dashboard.up_to_date}}\n                    {{else}}\n                      <span class=\"critical-note\">{{i18n admin.dashboard.critical_available}}</span>\n                      <span class=\"normal-note\">{{i18n admin.dashboard.updates_available}}</span>\n                      {{i18n admin.dashboard.please_upgrade}}\n                    {{/if}}\n                  </td>\n                {{/if}}\n              {{/if}}\n            </tbody>\n          {{/unless}}\n        </table>\n      </div>");
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/*global ace:true */

/**
  A view that wraps the ACE editor (http://ace.ajax.org/)

  @class AceEditorView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AceEditorView = Discourse.View.extend({
  mode: 'css',
  classNames: ['ace-wrapper'],

  contentChanged: (function() {
    if (this.editor && !this.skipContentChangeEvent) {
      return this.editor.getSession().setValue(this.get('content'));
    }
  }).observes('content'),

  render: function(buffer) {
    buffer.push("<div class='ace'>");
    if (this.get('content')) {
      buffer.push(Handlebars.Utils.escapeExpression(this.get('content')));
    }
    return buffer.push("</div>");
  },

  willDestroyElement: function() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  },

  didInsertElement: function() {

    var aceEditorView = this;

    var initAce = function() {
      aceEditorView.editor = ace.edit(aceEditorView.$('.ace')[0]);
      aceEditorView.editor.setTheme("ace/theme/chrome");
      aceEditorView.editor.setShowPrintMargin(false);
      aceEditorView.editor.getSession().setMode("ace/mode/" + (aceEditorView.get('mode')));
      aceEditorView.editor.on("change", function() {
        aceEditorView.skipContentChangeEvent = true;
        aceEditorView.set('content', aceEditorView.editor.getSession().getValue());
        aceEditorView.skipContentChangeEvent = false;
      });
    };

    if (window.ace) {
      initAce();
    } else {
      $LAB.script('/javascripts/ace/ace.js').wait(initAce);
    }
  }
});


Discourse.View.registerHelper('aceEditor', Discourse.AceEditorView);


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/ace_editor_view.js'] = "/*global ace:true */\n\n/**\n  A view that wraps the ACE editor (http://ace.ajax.org/)\n\n  @class AceEditorView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AceEditorView = Discourse.View.extend({\n  mode: 'css',\n  classNames: ['ace-wrapper'],\n\n  contentChanged: (function() {\n    if (this.editor \u0026\u0026 !this.skipContentChangeEvent) {\n      return this.editor.getSession().setValue(this.get('content'));\n    }\n  }).observes('content'),\n\n  render: function(buffer) {\n    buffer.push(\"\u003cdiv class='ace'\u003e\");\n    if (this.get('content')) {\n      buffer.push(Handlebars.Utils.escapeExpression(this.get('content')));\n    }\n    return buffer.push(\"\u003c/div\u003e\");\n  },\n\n  willDestroyElement: function() {\n    if (this.editor) {\n      this.editor.destroy();\n      this.editor = null;\n    }\n  },\n\n  didInsertElement: function() {\n\n    var aceEditorView = this;\n\n    var initAce = function() {\n      aceEditorView.editor = ace.edit(aceEditorView.$('.ace')[0]);\n      aceEditorView.editor.setTheme(\"ace/theme/chrome\");\n      aceEditorView.editor.setShowPrintMargin(false);\n      aceEditorView.editor.getSession().setMode(\"ace/mode/\" + (aceEditorView.get('mode')));\n      aceEditorView.editor.on(\"change\", function() {\n        aceEditorView.skipContentChangeEvent = true;\n        aceEditorView.set('content', aceEditorView.editor.getSession().getValue());\n        aceEditorView.skipContentChangeEvent = false;\n      });\n    };\n\n    if (window.ace) {\n      initAce();\n    } else {\n      $LAB.script('/javascripts/ace/ace.js').wait(initAce);\n    }\n  }\n});\n\n\nDiscourse.View.registerHelper('aceEditor', Discourse.AceEditorView);\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminApiView = Discourse.View.extend({
  templateName: 'admin/templates/api'
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_api_view.js'] = "Discourse.AdminApiView = Discourse.View.extend({\n  templateName: 'admin/templates/api'\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBackupsLogsView = Discourse.View.extend({

  classNames: ["admin-backups-logs"],

  _initialize: function() { this._reset(); }.on("init"),

  _reset: function() {
    this.setProperties({ formattedLogs: "", index: 0 });
  },

  _updateFormattedLogs: function() {
    var logs = this.get("controller.model");
    if (logs.length === 0) {
      this._reset(); // reset the cached logs whenever the model is reset
    } else {
      // do the log formatting only once for HELLish performance
      var formattedLogs = this.get("formattedLogs");
      for (var i = this.get("index"), length = logs.length; i < length; i++) {
        var date = moment(logs[i].get("timestamp")).format("YYYY-MM-DD HH:mm:ss"),
            message = Handlebars.Utils.escapeExpression(logs[i].get("message"));
        formattedLogs += "[" + date + "] " + message + "\n";
      }
      // update the formatted logs & cache index
      this.setProperties({ formattedLogs: formattedLogs, index: logs.length });
      // force rerender
      this.rerender();
    }
  }.observes("controller.model.@each"),

  render: function(buffer) {
    var formattedLogs = this.get("formattedLogs");
    if (formattedLogs && formattedLogs.length > 0) {
      buffer.push("<pre>");
      buffer.push(formattedLogs);
      buffer.push("</pre>");
    } else {
      buffer.push("<p>" + I18n.t("admin.backups.logs.none") + "</p>");
    }
    // add a loading indicator
    if (this.get("controller.status.isOperationRunning")) {
      buffer.push("<i class='fa fa-spinner fa-spin'></i>");
    }
  },

  _forceScrollToBottom: function() {
    var $div = this.$()[0];
    $div.scrollTop = $div.scrollHeight;
  }.on("didInsertElement")

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_backups_logs_view.js'] = "Discourse.AdminBackupsLogsView = Discourse.View.extend({\n\n  classNames: [\"admin-backups-logs\"],\n\n  _initialize: function() { this._reset(); }.on(\"init\"),\n\n  _reset: function() {\n    this.setProperties({ formattedLogs: \"\", index: 0 });\n  },\n\n  _updateFormattedLogs: function() {\n    var logs = this.get(\"controller.model\");\n    if (logs.length === 0) {\n      this._reset(); // reset the cached logs whenever the model is reset\n    } else {\n      // do the log formatting only once for HELLish performance\n      var formattedLogs = this.get(\"formattedLogs\");\n      for (var i = this.get(\"index\"), length = logs.length; i \u003c length; i++) {\n        var date = moment(logs[i].get(\"timestamp\")).format(\"YYYY-MM-DD HH:mm:ss\"),\n            message = Handlebars.Utils.escapeExpression(logs[i].get(\"message\"));\n        formattedLogs += \"[\" + date + \"] \" + message + \"\\n\";\n      }\n      // update the formatted logs \u0026 cache index\n      this.setProperties({ formattedLogs: formattedLogs, index: logs.length });\n      // force rerender\n      this.rerender();\n    }\n  }.observes(\"controller.model.@each\"),\n\n  render: function(buffer) {\n    var formattedLogs = this.get(\"formattedLogs\");\n    if (formattedLogs \u0026\u0026 formattedLogs.length \u003e 0) {\n      buffer.push(\"\u003cpre\u003e\");\n      buffer.push(formattedLogs);\n      buffer.push(\"\u003c/pre\u003e\");\n    } else {\n      buffer.push(\"\u003cp\u003e\" + I18n.t(\"admin.backups.logs.none\") + \"\u003c/p\u003e\");\n    }\n    // add a loading indicator\n    if (this.get(\"controller.status.isOperationRunning\")) {\n      buffer.push(\"\u003ci class='fa fa-spinner fa-spin'\u003e\u003c/i\u003e\");\n    }\n  },\n\n  _forceScrollToBottom: function() {\n    var $div = this.$()[0];\n    $div.scrollTop = $div.scrollHeight;\n  }.on(\"didInsertElement\")\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminBackupsView = Discourse.View.extend({
  classNames: ["admin-backups"],

  _hijackDownloads: function() {
    this.$().on("mouseup.admin-backups", "a.download", function (e) {
      var $link = $(e.currentTarget);

      if (!$link.data("href")) {
        $link.addClass("no-href");
        $link.data("href", $link.attr("href"));
        $link.attr("href", null);
        $link.data("auto-route", true);
      }

      Discourse.URL.redirectTo($link.data("href"));
    });
  }.on("didInsertElement"),

  _removeBindings: function() {
    this.$().off("mouseup.admin-backups");
  }.on("willDestroyElement")

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_backups_view.js'] = "Discourse.AdminBackupsView = Discourse.View.extend({\n  classNames: [\"admin-backups\"],\n\n  _hijackDownloads: function() {\n    this.$().on(\"mouseup.admin-backups\", \"a.download\", function (e) {\n      var $link = $(e.currentTarget);\n\n      if (!$link.data(\"href\")) {\n        $link.addClass(\"no-href\");\n        $link.data(\"href\", $link.attr(\"href\"));\n        $link.attr(\"href\", null);\n        $link.data(\"auto-route\", true);\n      }\n\n      Discourse.URL.redirectTo($link.data(\"href\"));\n    });\n  }.on(\"didInsertElement\"),\n\n  _removeBindings: function() {\n    this.$().off(\"mouseup.admin-backups\");\n  }.on(\"willDestroyElement\")\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A view to handle color selections within a site customization

  @class AdminCustomizeColorsView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeColorsView = Discourse.View.extend({
  templateName: 'admin/templates/customize_colors'
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_customize_colors_view.js'] = "/**\n  A view to handle color selections within a site customization\n\n  @class AdminCustomizeColorsView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminCustomizeColorsView = Discourse.View.extend({\n  templateName: 'admin/templates/customize_colors'\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/*global Mousetrap:true */

/**
  A view to handle site customizations

  @class AdminCustomizeView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeView = Discourse.View.extend({
  templateName: 'admin/templates/customize',
  classNames: ['customize'],
  selected: 'stylesheet',
  headerActive:           Em.computed.equal('selected', 'header'),
  stylesheetActive:       Em.computed.equal('selected', 'stylesheet'),
  mobileHeaderActive:     Em.computed.equal('selected', 'mobileHeader'),
  mobileStylesheetActive: Em.computed.equal('selected', 'mobileStylesheet'),

  actions: {
    selectHeader:           function() { this.set('selected', 'header'); },
    selectStylesheet:       function() { this.set('selected', 'stylesheet'); },
    selectMobileHeader:     function() { this.set('selected', 'mobileHeader'); },
    selectMobileStylesheet: function() { this.set('selected', 'mobileStylesheet'); }
  },

  didInsertElement: function() {
    var controller = this.get('controller');
    Mousetrap.bindGlobal('mod+s', function() {
      controller.send("save");
      return false;
    });
  },

  willDestroyElement: function() {
    Mousetrap.unbindGlobal('mod+s');
  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_customize_view.js'] = "/*global Mousetrap:true */\n\n/**\n  A view to handle site customizations\n\n  @class AdminCustomizeView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminCustomizeView = Discourse.View.extend({\n  templateName: 'admin/templates/customize',\n  classNames: ['customize'],\n  selected: 'stylesheet',\n  headerActive:           Em.computed.equal('selected', 'header'),\n  stylesheetActive:       Em.computed.equal('selected', 'stylesheet'),\n  mobileHeaderActive:     Em.computed.equal('selected', 'mobileHeader'),\n  mobileStylesheetActive: Em.computed.equal('selected', 'mobileStylesheet'),\n\n  actions: {\n    selectHeader:           function() { this.set('selected', 'header'); },\n    selectStylesheet:       function() { this.set('selected', 'stylesheet'); },\n    selectMobileHeader:     function() { this.set('selected', 'mobileHeader'); },\n    selectMobileStylesheet: function() { this.set('selected', 'mobileStylesheet'); }\n  },\n\n  didInsertElement: function() {\n    var controller = this.get('controller');\n    Mousetrap.bindGlobal('mod+s', function() {\n      controller.send(\"save\");\n      return false;\n    });\n  },\n\n  willDestroyElement: function() {\n    Mousetrap.unbindGlobal('mod+s');\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The default view in the admin section

  @class AdminDashboardView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminDashboardView = Discourse.View.extend({
  templateName: 'admin/templates/dashboard'
});




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_dashboard_view.js'] = "/**\n  The default view in the admin section\n\n  @class AdminDashboardView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminDashboardView = Discourse.View.extend({\n  templateName: 'admin/templates/dashboard'\n});\n\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminFlagsView = Discourse.View.extend(Discourse.LoadMore, {
  loading: false,
  eyelineSelector: '.admin-flags tbody tr',

  actions: {

    loadMore: function() {
      var self = this;

      if (this.get("loading") || this.get("model.allLoaded")) { return; }

      this.set("loading", true);

      this.get("controller").loadMore().then(function () {
        self.set("loading", false);
      });
    }

  }

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_flags_view.js'] = "Discourse.AdminFlagsView = Discourse.View.extend(Discourse.LoadMore, {\n  loading: false,\n  eyelineSelector: '.admin-flags tbody tr',\n\n  actions: {\n\n    loadMore: function() {\n      var self = this;\n\n      if (this.get(\"loading\") || this.get(\"model.allLoaded\")) { return; }\n\n      this.set(\"loading\", true);\n\n      this.get(\"controller\").loadMore().then(function () {\n        self.set(\"loading\", false);\n      });\n    }\n\n  }\n\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminIpLocatorView = Discourse.View.extend({
  templateName: 'admin/templates/ip_locator',
  classNames: ["iplocator"],
  actions: {
    hideBox: function(){
        this.set("showBox", false);
    },
    lookup: function(){
      if (!this.get("location")){
          $.get("http://ipinfo.io/" + this.get("ip"), function(response) {
              this.set("location", response);
          }.bind(this), "jsonp");
      }

      if (!this.get("other_accounts")){
        this.set("other_accounts_loading", true);
        Discourse.ajax("/admin/users/list/active.json", {
                data: {"ip": this.get("ip"),
                       "exclude": this.get("controller.id")
                      }
            }).then(function (users) {
                this.set("other_accounts", users.map(function(u) { return Discourse.AdminUser.create(u);}));
                this.set("other_accounts_loading", false);
            }.bind(this));
      }
      this.set("showBox", true);
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_ip_locator_view.js'] = "Discourse.AdminIpLocatorView = Discourse.View.extend({\n  templateName: 'admin/templates/ip_locator',\n  classNames: [\"iplocator\"],\n  actions: {\n    hideBox: function(){\n        this.set(\"showBox\", false);\n    },\n    lookup: function(){\n      if (!this.get(\"location\")){\n          $.get(\"http://ipinfo.io/\" + this.get(\"ip\"), function(response) {\n              this.set(\"location\", response);\n          }.bind(this), \"jsonp\");\n      }\n\n      if (!this.get(\"other_accounts\")){\n        this.set(\"other_accounts_loading\", true);\n        Discourse.ajax(\"/admin/users/list/active.json\", {\n                data: {\"ip\": this.get(\"ip\"),\n                       \"exclude\": this.get(\"controller.id\")\n                      }\n            }).then(function (users) {\n                this.set(\"other_accounts\", users.map(function(u) { return Discourse.AdminUser.create(u);}));\n                this.set(\"other_accounts_loading\", false);\n            }.bind(this));\n      }\n      this.set(\"showBox\", true);\n    }\n  }\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminSiteSettingsCategoryView = Discourse.View.extend({
  templateName: 'admin/templates/site_settings_category'
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_site_settings_category_view.js'] = "Discourse.AdminSiteSettingsCategoryView = Discourse.View.extend({\n  templateName: 'admin/templates/site_settings_category'\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The view class for an Admin User

  @class AdminUserView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUserView = Discourse.View.extend(Discourse.ScrollTop);



// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/admin_user_view.js'] = "/**\n  The view class for an Admin User\n\n  @class AdminUserView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminUserView = Discourse.View.extend(Discourse.ScrollTop);\n\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedEmailsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_emails_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/logs/screened_emails_list_view.js'] = "Discourse.ScreenedEmailsListView = Ember.ListView.extend({\n  height: 700,\n  rowHeight: 32,\n  itemViewClass: Ember.ListItemView.extend({templateName: \"admin/templates/logs/screened_emails_list_item\"})\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedIpAddressesListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_ip_addresses_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/logs/screened_ip_addresses_list_view.js'] = "Discourse.ScreenedIpAddressesListView = Ember.ListView.extend({\n  height: 700,\n  rowHeight: 32,\n  itemViewClass: Ember.ListItemView.extend({templateName: \"admin/templates/logs/screened_ip_addresses_list_item\"})\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedUrlsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_urls_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/logs/screened_urls_list_view.js'] = "Discourse.ScreenedUrlsListView = Ember.ListView.extend({\n  height: 700,\n  rowHeight: 32,\n  itemViewClass: Ember.ListItemView.extend({templateName: \"admin/templates/logs/screened_urls_list_item\"})\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.StaffActionLogsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 75,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/staff_action_logs_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/logs/staff_action_logs_list_view.js'] = "Discourse.StaffActionLogsListView = Ember.ListView.extend({\n  height: 700,\n  rowHeight: 75,\n  itemViewClass: Ember.ListItemView.extend({templateName: \"admin/templates/logs/staff_action_logs_list_item\"})\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for agreeing with a flag.

  @class AdminAgreeFlagView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminAgreeFlagView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_agree_flag',
  title: I18n.t('admin.flags.agree_flag_modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_agree_flag_view.js'] = "/**\n  A modal view for agreeing with a flag.\n\n  @class AdminAgreeFlagView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminAgreeFlagView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_agree_flag',\n  title: I18n.t('admin.flags.agree_flag_modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:


Discourse.AdminBadgePreviewView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_badge_preview',
  title: I18n.t('admin.badges.preview.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_badge_preview_view.js'] = "\nDiscourse.AdminBadgePreviewView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_badge_preview',\n  title: I18n.t('admin.badges.preview.modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for deleting a flag.

  @class AdminDeleteFlagView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminDeleteFlagView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_delete_flag',
  title: I18n.t('admin.flags.delete_flag_modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_delete_flag_view.js'] = "/**\n  A modal view for deleting a flag.\n\n  @class AdminDeleteFlagView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminDeleteFlagView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_delete_flag',\n  title: I18n.t('admin.flags.delete_flag_modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:


Discourse.AdminEditBadgeGroupingsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_edit_badge_groupings',
  title: I18n.t('admin.badges.badge_groupings.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_edit_badge_groupings_view.js'] = "\nDiscourse.AdminEditBadgeGroupingsView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_edit_badge_groupings',\n  title: I18n.t('admin.badges.badge_groupings.modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal.

  @class AdminStaffActionLogDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminStaffActionLogDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/details_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_staff_action_log_details_view.js'] = "/**\n  A modal view for details of a staff action log record in a modal.\n\n  @class AdminStaffActionLogDetailsView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminStaffActionLogDetailsView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/logs/details_modal',\n  title: I18n.t('admin.logs.staff_actions.modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminStartBackupView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_start_backup',
  title: I18n.t('admin.backups.operations.backup.confirm')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_start_backup_view.js'] = "Discourse.AdminStartBackupView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_start_backup',\n  title: I18n.t('admin.backups.operations.backup.confirm')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for suspending a user.

  @class AdminSuspendUserView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSuspendUserView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_suspend_user',
  title: I18n.t('admin.user.suspend_modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/admin_suspend_user_view.js'] = "/**\n  A modal view for suspending a user.\n\n  @class AdminSuspendUserView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.AdminSuspendUserView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/modal/admin_suspend_user',\n  title: I18n.t('admin.user.suspend_modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal
  for when a site customization is created or changed.

  @class ChangeSiteCustomizationDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.ChangeSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/site_customization_change_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/change_site_customization_details_view.js'] = "/**\n  A modal view for details of a staff action log record in a modal\n  for when a site customization is created or changed.\n\n  @class ChangeSiteCustomizationDetailsView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.ChangeSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/logs/site_customization_change_modal',\n  title: I18n.t('admin.logs.staff_actions.modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal
  for when a site customization is deleted.

  @class DeleteSiteCustomizationDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.DeleteSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/site_customization_change_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/modals/delete_site_customization_details_view.js'] = "/**\n  A modal view for details of a staff action log record in a modal\n  for when a site customization is deleted.\n\n  @class DeleteSiteCustomizationDetailsView\n  @extends Discourse.ModalBodyView\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.DeleteSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({\n  templateName: 'admin/templates/logs/site_customization_change_modal',\n  title: I18n.t('admin.logs.staff_actions.modal_title')\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminReportCountsView = Discourse.View.extend({
  templateName: 'admin/templates/reports/summed_counts_report',
  tagName: 'tbody'
});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/report/admin_report_counts_view.js'] = "Discourse.AdminReportCountsView = Discourse.View.extend({\n  templateName: 'admin/templates/reports/summed_counts_report',\n  tagName: 'tbody'\n});\n";
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A view to display a site setting with edit controls

  @class SiteSettingView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteSettingView = Discourse.View.extend(Discourse.ScrollTop, {
  classNameBindings: [':row', ':setting', 'content.overridden'],

  templateName: function() {
    // If we're editing a boolean, show a checkbox
    if (this.get('content.type') === 'bool') return 'admin/templates/site_settings/setting_bool';

    // If we're editing an enum field, show a dropdown
    if (this.get('content.type') === 'enum' ) return 'admin/templates/site_settings/setting_enum';

    // If we're editing a list, show a list editor
    if (this.get('content.type') === 'list' ) return 'admin/templates/site_settings/setting_list';

    // Default to string editor
    return 'admin/templates/site_settings/setting_string';

  }.property('content.type'),

  _watchEnterKey: function() {
    var self = this;
    this.$().on("keydown.site-setting-enter", ".input-setting-string", function (e) {
      if (e.keyCode === 13) { // enter key
        var setting = self.get('content');
        if (setting.get('dirty')) {
          setting.save();
        }
      }
    });
  }.on('didInsertElement'),

  _removeBindings: function() {
    this.$().off("keydown.site-setting-enter");
  }.on("willDestroyElement")

});


// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin/views/site_setting_view.js'] = "/**\n  A view to display a site setting with edit controls\n\n  @class SiteSettingView\n  @extends Discourse.View\n  @namespace Discourse\n  @module Discourse\n**/\n\nDiscourse.SiteSettingView = Discourse.View.extend(Discourse.ScrollTop, {\n  classNameBindings: [':row', ':setting', 'content.overridden'],\n\n  templateName: function() {\n    // If we're editing a boolean, show a checkbox\n    if (this.get('content.type') === 'bool') return 'admin/templates/site_settings/setting_bool';\n\n    // If we're editing an enum field, show a dropdown\n    if (this.get('content.type') === 'enum' ) return 'admin/templates/site_settings/setting_enum';\n\n    // If we're editing a list, show a list editor\n    if (this.get('content.type') === 'list' ) return 'admin/templates/site_settings/setting_list';\n\n    // Default to string editor\n    return 'admin/templates/site_settings/setting_string';\n\n  }.property('content.type'),\n\n  _watchEnterKey: function() {\n    var self = this;\n    this.$().on(\"keydown.site-setting-enter\", \".input-setting-string\", function (e) {\n      if (e.keyCode === 13) { // enter key\n        var setting = self.get('content');\n        if (setting.get('dirty')) {\n          setting.save();\n        }\n      }\n    });\n  }.on('didInsertElement'),\n\n  _removeBindings: function() {\n    this.$().off(\"keydown.site-setting-enter\");\n  }.on(\"willDestroyElement\")\n\n});\n";
/*
* MIT Licensed
* http://www.23developer.com/opensource
* http://github.com/23/resumable.js
* Steffen Tiedemann Christensen, steffen@23company.com
*/


(function(){
"use strict";

  var Resumable = function(opts){
    if ( !(this instanceof Resumable) ) {
      return new Resumable(opts);
    }
    this.version = 1.0;
    // SUPPORTED BY BROWSER?
    // Check if these features are support by the browser:
    // - File object type
    // - Blob object type
    // - FileList object type
    // - slicing files
    this.support = (
                   (typeof(File)!=='undefined')
                   &&
                   (typeof(Blob)!=='undefined')
                   &&
                   (typeof(FileList)!=='undefined')
                   &&
                   (!!Blob.prototype.webkitSlice||!!Blob.prototype.mozSlice||!!Blob.prototype.slice||false)
                   );
    if(!this.support) return(false);


    // PROPERTIES
    var $ = this;
    $.files = [];
    $.defaults = {
      chunkSize:1*1024*1024,
      forceChunkSize:false,
      simultaneousUploads:3,
      fileParameterName:'file',
      throttleProgressCallbacks:0.5,
      query:{},
      headers:{},
      preprocess:null,
      method:'multipart',
      prioritizeFirstAndLastChunk:false,
      target:'/',
      testChunks:true,
      generateUniqueIdentifier:null,
      maxChunkRetries:undefined,
      chunkRetryInterval:undefined,
      permanentErrors:[404, 415, 500, 501],
      maxFiles:undefined,
      withCredentials:false,
      xhrTimeout:0,
      maxFilesErrorCallback:function (files, errorCount) {
        var maxFiles = $.getOpt('maxFiles');
        alert('Please upload ' + maxFiles + ' file' + (maxFiles === 1 ? '' : 's') + ' at a time.');
      },
      minFileSize:1,
      minFileSizeErrorCallback:function(file, errorCount) {
        alert(file.fileName||file.name +' is too small, please upload files larger than ' + $h.formatSize($.getOpt('minFileSize')) + '.');
      },
      maxFileSize:undefined,
      maxFileSizeErrorCallback:function(file, errorCount) {
        alert(file.fileName||file.name +' is too large, please upload files less than ' + $h.formatSize($.getOpt('maxFileSize')) + '.');
      },
      fileType: [],
      fileTypeErrorCallback: function(file, errorCount) {
        alert(file.fileName||file.name +' has type not allowed, please upload files of type ' + $.getOpt('fileType') + '.');
      }
    };
    $.opts = opts||{};
    $.getOpt = function(o) {
      var $opt = this;
      // Get multiple option if passed an array
      if(o instanceof Array) {
        var options = {};
        $h.each(o, function(option){
          options[option] = $opt.getOpt(option);
        });
        return options;
      }
      // Otherwise, just return a simple option
      if ($opt instanceof ResumableChunk) {
        if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
        else { $opt = $opt.fileObj; }
      }
      if ($opt instanceof ResumableFile) {
        if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
        else { $opt = $opt.resumableObj; }
      }
      if ($opt instanceof Resumable) {
        if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
        else { return $opt.defaults[o]; }
      }
    };

    // EVENTS
    // catchAll(event, ...)
    // fileSuccess(file), fileProgress(file), fileAdded(file, event), fileRetry(file), fileError(file, message),
    // complete(), progress(), error(message, file), pause()
    $.events = [];
    $.on = function(event,callback){
      $.events.push(event.toLowerCase(), callback);
    };
    $.fire = function(){
      // `arguments` is an object, not array, in FF, so:
      var args = [];
      for (var i=0; i<arguments.length; i++) args.push(arguments[i]);
      // Find event listeners, and support pseudo-event `catchAll`
      var event = args[0].toLowerCase();
      for (var i=0; i<=$.events.length; i+=2) {
        if($.events[i]==event) $.events[i+1].apply($,args.slice(1));
        if($.events[i]=='catchall') $.events[i+1].apply(null,args);
      }
      if(event=='fileerror') $.fire('error', args[2], args[1]);
      if(event=='fileprogress') $.fire('progress');
    };


    // INTERNAL HELPER METHODS (handy, but ultimately not part of uploading)
    var $h = {
      stopEvent: function(e){
        e.stopPropagation();
        e.preventDefault();
      },
      each: function(o,callback){
        if(typeof(o.length)!=='undefined') {
          for (var i=0; i<o.length; i++) {
            // Array or FileList
            if(callback(o[i])===false) return;
          }
        } else {
          for (i in o) {
            // Object
            if(callback(i,o[i])===false) return;
          }
        }
      },
      generateUniqueIdentifier:function(file){
        var custom = $.getOpt('generateUniqueIdentifier');
        if(typeof custom === 'function') {
          return custom(file);
        }
        var relativePath = file.webkitRelativePath||file.fileName||file.name; // Some confusion in different versions of Firefox
        var size = file.size;
        return(size + '-' + relativePath.replace(/[^0-9a-zA-Z_-]/img, ''));
      },
      contains:function(array,test) {
        var result = false;

        $h.each(array, function(value) {
          if (value == test) {
            result = true;
            return false;
          }
          return true;
        });

        return result;
      },
      formatSize:function(size){
        if(size<1024) {
          return size + ' bytes';
        } else if(size<1024*1024) {
          return (size/1024.0).toFixed(0) + ' KB';
        } else if(size<1024*1024*1024) {
          return (size/1024.0/1024.0).toFixed(1) + ' MB';
        } else {
          return (size/1024.0/1024.0/1024.0).toFixed(1) + ' GB';
        }
      },
      getTarget:function(params){
        var target = $.getOpt('target');
        if(target.indexOf('?') < 0) {
          target += '?';
        } else {
          target += '&';
        }
        return target + params.join('&');
      }
    };

    var onDrop = function(event){
      $h.stopEvent(event);
      appendFilesFromFileList(event.dataTransfer.files, event);
    };
    var onDragOver = function(e) {
      e.preventDefault();
    };

    // INTERNAL METHODS (both handy and responsible for the heavy load)
    var appendFilesFromFileList = function(fileList, event){
      // check for uploading too many files
      var errorCount = 0;
      var o = $.getOpt(['maxFiles', 'minFileSize', 'maxFileSize', 'maxFilesErrorCallback', 'minFileSizeErrorCallback', 'maxFileSizeErrorCallback', 'fileType', 'fileTypeErrorCallback']);
      if (typeof(o.maxFiles)!=='undefined' && o.maxFiles<(fileList.length+$.files.length)) {
        // if single-file upload, file is already added, and trying to add 1 new file, simply replace the already-added file
        if (o.maxFiles===1 && $.files.length===1 && fileList.length===1) {
          $.removeFile($.files[0]);
        } else {
          o.maxFilesErrorCallback(fileList, errorCount++);
          return false;
        }
      }
      var files = [];
      $h.each(fileList, function(file){
        var fileName = file.name.split('.');
        var fileType = fileName[fileName.length-1].toLowerCase();

        if (o.fileType.length > 0 && !$h.contains(o.fileType, fileType)) {
          o.fileTypeErrorCallback(file, errorCount++);
          return false;
        }

        if (typeof(o.minFileSize)!=='undefined' && file.size<o.minFileSize) {
          o.minFileSizeErrorCallback(file, errorCount++);
          return false;
        }
        if (typeof(o.maxFileSize)!=='undefined' && file.size>o.maxFileSize) {
          o.maxFileSizeErrorCallback(file, errorCount++);
          return false;
        }

        // directories have size == 0
        if (!$.getFromUniqueIdentifier($h.generateUniqueIdentifier(file))) {(function(){
          var f = new ResumableFile($, file);
          window.setTimeout(function(){
            $.files.push(f);
            files.push(f);
            $.fire('fileAdded', f, event)
          },0);
        })()};
      });
      window.setTimeout(function(){
        $.fire('filesAdded', files)
      },0);
    };

    // INTERNAL OBJECT TYPES
    function ResumableFile(resumableObj, file){
      var $ = this;
      $.opts = {};
      $.getOpt = resumableObj.getOpt;
      $._prevProgress = 0;
      $.resumableObj = resumableObj;
      $.file = file;
      $.fileName = file.fileName||file.name; // Some confusion in different versions of Firefox
      $.size = file.size;
      $.relativePath = file.webkitRelativePath || $.fileName;
      $.uniqueIdentifier = $h.generateUniqueIdentifier(file);
      $._pause = false;
      var _error = false;

      // Callback when something happens within the chunk
      var chunkEvent = function(event, message){
        // event can be 'progress', 'success', 'error' or 'retry'
        switch(event){
        case 'progress':
          $.resumableObj.fire('fileProgress', $);
          break;
        case 'error':
          $.abort();
          _error = true;
          $.chunks = [];
          $.resumableObj.fire('fileError', $, message);
          break;
        case 'success':
          if(_error) return;
          $.resumableObj.fire('fileProgress', $); // it's at least progress
          if($.isComplete()) {
            $.resumableObj.fire('fileSuccess', $, message);
          }
          break;
        case 'retry':
          $.resumableObj.fire('fileRetry', $);
          break;
        }
      };

      // Main code to set up a file object with chunks,
      // packaged to be able to handle retries if needed.
      $.chunks = [];
      $.abort = function(){
        // Stop current uploads
        var abortCount = 0;
        $h.each($.chunks, function(c){
          if(c.status()=='uploading') {
            c.abort();
            abortCount++;
          }
        });
        if(abortCount>0) $.resumableObj.fire('fileProgress', $);
      }
      $.cancel = function(){
        // Reset this file to be void
        var _chunks = $.chunks;
        $.chunks = [];
        // Stop current uploads
        $h.each(_chunks, function(c){
          if(c.status()=='uploading')  {
            c.abort();
            $.resumableObj.uploadNextChunk();
          }
        });
        $.resumableObj.removeFile($);
        $.resumableObj.fire('fileProgress', $);
      };
      $.retry = function(){
        $.bootstrap();
        $.resumableObj.upload();
      };
      $.bootstrap = function(){
        $.abort();
        _error = false;
        // Rebuild stack of chunks from file
        $.chunks = [];
        $._prevProgress = 0;
        var round = $.getOpt('forceChunkSize') ? Math.ceil : Math.floor;
        var maxOffset = Math.max(round($.file.size/$.getOpt('chunkSize')),1);
        for (var offset=0; offset<maxOffset; offset++) {(function(offset){
            window.setTimeout(function(){
                $.chunks.push(new ResumableChunk($.resumableObj, $, offset, chunkEvent));
                $.resumableObj.fire('chunkingProgress',$,offset/maxOffset);
            },0);
        })(offset)}
        window.setTimeout(function(){
            $.resumableObj.fire('chunkingComplete',$);
        },0);
      };
      $.progress = function(){
        if(_error) return(1);
        // Sum up progress across everything
        var ret = 0;
        var error = false;
        $h.each($.chunks, function(c){
          if(c.status()=='error') error = true;
          ret += c.progress(true); // get chunk progress relative to entire file
        });
        ret = (error ? 1 : (ret>0.999 ? 1 : ret));
        ret = Math.max($._prevProgress, ret); // We don't want to lose percentages when an upload is paused
        $._prevProgress = ret;
        return(ret);
      };
      $.isUploading = function(){
        var uploading = false;
        $h.each($.chunks, function(chunk){
          if(chunk.status()=='uploading') {
            uploading = true;
            return(false);
          }
        });
        return(uploading);
      };
      $.isComplete = function(){
        var outstanding = false;
        $h.each($.chunks, function(chunk){
          var status = chunk.status();
          if(status=='pending' || status=='uploading' || chunk.preprocessState === 1) {
            outstanding = true;
            return(false);
          }
        });
        return(!outstanding);
      };
      $.pause = function(pause){
          if(typeof(pause)==='undefined'){
              $._pause = ($._pause ? false : true);
          }else{
              $._pause = pause;
          }
      };
      $.isPaused = function() {
        return $._pause;
      };


      // Bootstrap and return
      $.resumableObj.fire('chunkingStart', $);
      $.bootstrap();
      return(this);
    }

    function ResumableChunk(resumableObj, fileObj, offset, callback){
      var $ = this;
      $.opts = {};
      $.getOpt = resumableObj.getOpt;
      $.resumableObj = resumableObj;
      $.fileObj = fileObj;
      $.fileObjSize = fileObj.size;
      $.fileObjType = fileObj.file.type;
      $.offset = offset;
      $.callback = callback;
      $.lastProgressCallback = (new Date);
      $.tested = false;
      $.retries = 0;
      $.pendingRetry = false;
      $.preprocessState = 0; // 0 = unprocessed, 1 = processing, 2 = finished

      // Computed properties
      var chunkSize = $.getOpt('chunkSize');
      $.loaded = 0;
      $.startByte = $.offset*chunkSize;
      $.endByte = Math.min($.fileObjSize, ($.offset+1)*chunkSize);
      if ($.fileObjSize-$.endByte < chunkSize && !$.getOpt('forceChunkSize')) {
        // The last chunk will be bigger than the chunk size, but less than 2*chunkSize
        $.endByte = $.fileObjSize;
      }
      $.xhr = null;

      // test() makes a GET request without any data to see if the chunk has already been uploaded in a previous session
      $.test = function(){
        // Set up request and listen for event
        $.xhr = new XMLHttpRequest();

        var testHandler = function(e){
          $.tested = true;
          var status = $.status();
          if(status=='success') {
            $.callback(status, $.message());
            $.resumableObj.uploadNextChunk();
          } else {
            $.send();
          }
        };
        $.xhr.addEventListener('load', testHandler, false);
        $.xhr.addEventListener('error', testHandler, false);

        // Add data from the query options
        var params = [];
        var customQuery = $.getOpt('query');
        if(typeof customQuery == 'function') customQuery = customQuery($.fileObj, $);
        $h.each(customQuery, function(k,v){
          params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='));
        });
        // Add extra data to identify chunk
        params.push(['resumableChunkNumber', encodeURIComponent($.offset+1)].join('='));
        params.push(['resumableChunkSize', encodeURIComponent($.getOpt('chunkSize'))].join('='));
        params.push(['resumableCurrentChunkSize', encodeURIComponent($.endByte - $.startByte)].join('='));
        params.push(['resumableTotalSize', encodeURIComponent($.fileObjSize)].join('='));
        params.push(['resumableType', encodeURIComponent($.fileObjType)].join('='));
        params.push(['resumableIdentifier', encodeURIComponent($.fileObj.uniqueIdentifier)].join('='));
        params.push(['resumableFilename', encodeURIComponent($.fileObj.fileName)].join('='));
        params.push(['resumableRelativePath', encodeURIComponent($.fileObj.relativePath)].join('='));
        // Append the relevant chunk and send it
        $.xhr.open('GET', $h.getTarget(params));
        $.xhr.timeout = $.getOpt('xhrTimeout');
        $.xhr.withCredentials = $.getOpt('withCredentials');
        // Add data from header options
        $h.each($.getOpt('headers'), function(k,v) {
          $.xhr.setRequestHeader(k, v);
        });
        $.xhr.send(null);
      };

      $.preprocessFinished = function(){
        $.preprocessState = 2;
        $.send();
      };

      // send() uploads the actual data in a POST call
      $.send = function(){
        var preprocess = $.getOpt('preprocess');
        if(typeof preprocess === 'function') {
          switch($.preprocessState) {
          case 0: preprocess($); $.preprocessState = 1; return;
          case 1: return;
          case 2: break;
          }
        }
        if($.getOpt('testChunks') && !$.tested) {
          $.test();
          return;
        }

        // Set up request and listen for event
        $.xhr = new XMLHttpRequest();

        // Progress
        $.xhr.upload.addEventListener('progress', function(e){
          if( (new Date) - $.lastProgressCallback > $.getOpt('throttleProgressCallbacks') * 1000 ) {
            $.callback('progress');
            $.lastProgressCallback = (new Date);
          }
          $.loaded=e.loaded||0;
        }, false);
        $.loaded = 0;
        $.pendingRetry = false;
        $.callback('progress');

        // Done (either done, failed or retry)
        var doneHandler = function(e){
          var status = $.status();
          if(status=='success'||status=='error') {
            $.callback(status, $.message());
            $.resumableObj.uploadNextChunk();
          } else {
            $.callback('retry', $.message());
            $.abort();
            $.retries++;
            var retryInterval = $.getOpt('chunkRetryInterval');
            if(retryInterval !== undefined) {
              $.pendingRetry = true;
              setTimeout($.send, retryInterval);
            } else {
              $.send();
            }
          }
        };
        $.xhr.addEventListener('load', doneHandler, false);
        $.xhr.addEventListener('error', doneHandler, false);

        // Set up the basic query data from Resumable
        var query = {
          resumableChunkNumber: $.offset+1,
          resumableChunkSize: $.getOpt('chunkSize'),
          resumableCurrentChunkSize: $.endByte - $.startByte,
          resumableTotalSize: $.fileObjSize,
          resumableType: $.fileObjType,
          resumableIdentifier: $.fileObj.uniqueIdentifier,
          resumableFilename: $.fileObj.fileName,
          resumableRelativePath: $.fileObj.relativePath,
          resumableTotalChunks: $.fileObj.chunks.length
        };
        // Mix in custom data
        var customQuery = $.getOpt('query');
        if(typeof customQuery == 'function') customQuery = customQuery($.fileObj, $);
        $h.each(customQuery, function(k,v){
          query[k] = v;
        });

        var func   = ($.fileObj.file.slice ? 'slice' : ($.fileObj.file.mozSlice ? 'mozSlice' : ($.fileObj.file.webkitSlice ? 'webkitSlice' : 'slice'))),
        bytes  = $.fileObj.file[func]($.startByte,$.endByte),
        data   = null,
        target = $.getOpt('target');

        if ($.getOpt('method') === 'octet') {
          // Add data from the query options
          data = bytes;
          var params = [];
          $h.each(query, function(k,v){
            params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='));
          });
          target = $h.getTarget(params);
        } else {
          // Add data from the query options
          data = new FormData();
          $h.each(query, function(k,v){
            data.append(k,v);
          });
          data.append($.getOpt('fileParameterName'), bytes);
        }

        $.xhr.open('POST', target);
        $.xhr.timeout = $.getOpt('xhrTimeout');
        $.xhr.withCredentials = $.getOpt('withCredentials');
        // Add data from header options
        $h.each($.getOpt('headers'), function(k,v) {
          $.xhr.setRequestHeader(k, v);
        });
        $.xhr.send(data);
      };
      $.abort = function(){
        // Abort and reset
        if($.xhr) $.xhr.abort();
        $.xhr = null;
      };
      $.status = function(){
        // Returns: 'pending', 'uploading', 'success', 'error'
        if($.pendingRetry) {
          // if pending retry then that's effectively the same as actively uploading,
          // there might just be a slight delay before the retry starts
          return('uploading')
        } else if(!$.xhr) {
          return('pending');
        } else if($.xhr.readyState<4) {
          // Status is really 'OPENED', 'HEADERS_RECEIVED' or 'LOADING' - meaning that stuff is happening
          return('uploading');
        } else {
          if($.xhr.status==200) {
            // HTTP 200, perfect
            return('success');
          } else if($h.contains($.getOpt('permanentErrors'), $.xhr.status) || $.retries >= $.getOpt('maxChunkRetries')) {
            // HTTP 415/500/501, permanent error
            return('error');
          } else {
            // this should never happen, but we'll reset and queue a retry
            // a likely case for this would be 503 service unavailable
            $.abort();
            return('pending');
          }
        }
      };
      $.message = function(){
        return($.xhr ? $.xhr.responseText : '');
      };
      $.progress = function(relative){
        if(typeof(relative)==='undefined') relative = false;
        var factor = (relative ? ($.endByte-$.startByte)/$.fileObjSize : 1);
        if($.pendingRetry) return(0);
        var s = $.status();
        switch(s){
        case 'success':
        case 'error':
          return(1*factor);
        case 'pending':
          return(0*factor);
        default:
          return($.loaded/($.endByte-$.startByte)*factor);
        }
      };
      return(this);
    }

    // QUEUE
    $.uploadNextChunk = function(){
      var found = false;

      // In some cases (such as videos) it's really handy to upload the first
      // and last chunk of a file quickly; this let's the server check the file's
      // metadata and determine if there's even a point in continuing.
      if ($.getOpt('prioritizeFirstAndLastChunk')) {
        $h.each($.files, function(file){
          if(file.chunks.length && file.chunks[0].status()=='pending' && file.chunks[0].preprocessState === 0) {
            file.chunks[0].send();
            found = true;
            return(false);
          }
          if(file.chunks.length>1 && file.chunks[file.chunks.length-1].status()=='pending' && file.chunks[0].preprocessState === 0) {
            file.chunks[file.chunks.length-1].send();
            found = true;
            return(false);
          }
        });
        if(found) return(true);
      }

      // Now, simply look for the next, best thing to upload
      $h.each($.files, function(file){
        if(file.isPaused()===false){
         $h.each(file.chunks, function(chunk){
           if(chunk.status()=='pending' && chunk.preprocessState === 0) {
             chunk.send();
             found = true;
             return(false);
           }
          });
        }
        if(found) return(false);
      });
      if(found) return(true);

      // The are no more outstanding chunks to upload, check is everything is done
      var outstanding = false;
      $h.each($.files, function(file){
        if(!file.isComplete()) {
          outstanding = true;
          return(false);
        }
      });
      if(!outstanding) {
        // All chunks have been uploaded, complete
        $.fire('complete');
      }
      return(false);
    };


    // PUBLIC METHODS FOR RESUMABLE.JS
    $.assignBrowse = function(domNodes, isDirectory){
      if(typeof(domNodes.length)=='undefined') domNodes = [domNodes];

      $h.each(domNodes, function(domNode) {
        var input;
        if(domNode.tagName==='INPUT' && domNode.type==='file'){
          input = domNode;
        } else {
          input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.style.display = 'none';
          domNode.addEventListener('click', function(){
            input.click();
          }, false);
          domNode.appendChild(input);
        }
        var maxFiles = $.getOpt('maxFiles');
        if (typeof(maxFiles)==='undefined'||maxFiles!=1){
          input.setAttribute('multiple', 'multiple');
        } else {
          input.removeAttribute('multiple');
        }
        if(isDirectory){
          input.setAttribute('webkitdirectory', 'webkitdirectory');
        } else {
          input.removeAttribute('webkitdirectory');
        }
        // When new files are added, simply append them to the overall list
        input.addEventListener('change', function(e){
          appendFilesFromFileList(e.target.files);
          e.target.value = '';
        }, false);
      });
    };
    $.assignDrop = function(domNodes){
      if(typeof(domNodes.length)=='undefined') domNodes = [domNodes];

      $h.each(domNodes, function(domNode) {
        domNode.addEventListener('dragover', onDragOver, false);
        domNode.addEventListener('drop', onDrop, false);
      });
    };
    $.unAssignDrop = function(domNodes) {
      if (typeof(domNodes.length) == 'undefined') domNodes = [domNodes];

      $h.each(domNodes, function(domNode) {
        domNode.removeEventListener('dragover', onDragOver);
        domNode.removeEventListener('drop', onDrop);
      });
    };
    $.isUploading = function(){
      var uploading = false;
      $h.each($.files, function(file){
        if (file.isUploading()) {
          uploading = true;
          return(false);
        }
      });
      return(uploading);
    };
    $.upload = function(){
      // Make sure we don't start too many uploads at once
      if($.isUploading()) return;
      // Kick off the queue
      $.fire('uploadStart');
      for (var num=1; num<=$.getOpt('simultaneousUploads'); num++) {
        $.uploadNextChunk();
      }
    };
    $.pause = function(){
      // Resume all chunks currently being uploaded
      $h.each($.files, function(file){
        file.abort();
      });
      $.fire('pause');
    };
    $.cancel = function(){
      for(var i = $.files.length - 1; i >= 0; i--) {
        $.files[i].cancel();
      }
      $.fire('cancel');
    };
    $.progress = function(){
      var totalDone = 0;
      var totalSize = 0;
      // Resume all chunks currently being uploaded
      $h.each($.files, function(file){
        totalDone += file.progress()*file.size;
        totalSize += file.size;
      });
      return(totalSize>0 ? totalDone/totalSize : 0);
    };
    $.addFile = function(file){
      appendFilesFromFileList([file]);
    };
    $.removeFile = function(file){
      for(var i = $.files.length - 1; i >= 0; i--) {
        if($.files[i] === file) {
          $.files.splice(i, 1);
        }
      }
    };
    $.getFromUniqueIdentifier = function(uniqueIdentifier){
      var ret = false;
      $h.each($.files, function(f){
        if(f.uniqueIdentifier==uniqueIdentifier) ret = f;
      });
      return(ret);
    };
    $.getSize = function(){
      var totalSize = 0;
      $h.each($.files, function(file){
        totalSize += file.size;
      });
      return(totalSize);
    };

    return(this);
  };


  // Node.js-style export for Node and Component
  if (typeof module != 'undefined') {
    module.exports = Resumable;
  } else if (typeof define === "function" && define.amd) {
    // AMD/requirejs: Define the module
    define(function(){
      return Resumable;
    });
  } else {
    // Browser: Expose to window
    window.Resumable = Resumable;
  }

})();





(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:




// IIFE Wrapped Content Ends

 })(this);
window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/admin.js.erb'] = "\u003c%\nif Rails.env.development?\n  require_asset (\"development/list-view.js\")\nelse\n  require_asset (\"production/list-view.js\")\nend\n\nrequire_asset(\"main_include_admin.js\")\n\nDiscoursePluginRegistry.admin_javascripts.each { |js| require_asset(js) }\n\n%\u003e\n";
