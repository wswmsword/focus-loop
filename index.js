/** document.activeElement 的快捷方式 */
const getActiveElement = () => document.activeElement;

/** document.querySelector 的快捷方式 */
const querySelector = str => document.querySelector(str);

/** 通过字符串查找节点，或者直接返回节点 */
const element = e => typeof e === "string" ? querySelector(e) : e;

/** 滴答 */
const tick = function(fn) {
  setTimeout(fn, 0);
};

/** 是否是 input 可 select 的元素 */
const isSelectableInput = function(node) {
  return (
    node.tagName &&
    node.tagName.toLowerCase() === 'input' &&
    typeof node.select === 'function'
  );
};

/** 聚焦，如果是 input，则聚焦后选中 */
const focus = function(e) {
  e.focus();
  if (isSelectableInput(e))
    e.select();
};

/** 尝试聚焦，如果聚焦失效，则下个事件循环再次聚焦 */
const tryFocus = function(e) {
  if (e == null) tick(() => e && focus(e))
  else focus(e);
};

/** 是否按下了 enter */
const isEnterEvent = function(e) {
  return e.key === "Enter" || e.keyCode === 13;
};

/** 按键是否是 esc */
const isEscapeEvent = function (e) {
  return e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
};

/** 按键是否是 tab */
const isTabEvent = function(e) {
  return e.key === 'Tab' || e.keyCode === 9;
};

/** 是否是向前的 tab */
const isTabForward = function(e) {
  return isTabEvent(e) && !e.shiftKey;
};

/** 是否是向后的 tab */
const isTabBackward = function(e) {
  return isTabEvent(e) && e.shiftKey;
};

/** 手动聚焦下一个元素 */
const focusNextManually = (subNodes, container, activeIndex, isClamp, cover, onEscape, isForward, isBackward) => e => {
  if (isEscapeEvent(e)) {
    onEscape();
    return;
  }

  if (cover && e.target === container) {
    if (isTabForward(e))
      focus(subNodes.slice(-1)[0]);
    else if (isEnterEvent(e))
      focus(subNodes[0]);
  }

  if ((isForward ?? isTabForward)(e)) {
    const itemsLen = subNodes.length;
    const nextI = activeIndex + 1;
    activeIndex = isClamp ? Math.min(itemsLen - 1, nextI) : nextI;
    activeIndex %= itemsLen;
    e.preventDefault();
    focus(subNodes[activeIndex])
  }
  else if ((isBackward ?? isTabBackward)(e)) {
    const itemsLen = subNodes.length;
    const nextI = activeIndex - 1;
    activeIndex = isClamp ? Math.max(0, nextI) : nextI;
    activeIndex = (activeIndex + itemsLen) % itemsLen;
    e.preventDefault();
    focus(subNodes[activeIndex]);
  }
};

/** 按下 tab，自动聚焦下个元素 */
const focusNextKey = (head, tail, container, isClamp, cover, onEscape) => e => {
  const targ = e.target;
  if (isEscapeEvent(e)) {
    onEscape();
    return;
  }

  if (cover && targ === container) {
    if (isTabForward(e))
      focus(tail);
    else if (isEnterEvent(e))
      focus(head);
  }

  if (isTabForward(e)) {
    if (targ === tail) {
      e.preventDefault();
      if (!isClamp) focus(head);
    }
  }
  else if (isTabBackward(e)) {
    if (targ === head) {
      e.preventDefault();
      if (!isClamp) focus(tail);
    }
  }
};

/** 在遮罩的后一个元素按下 shift-tab */
const handleCoverShiftTab = container => e => {
  if (isTabBackward(e)) {
    e.preventDefault(container);
    focus()
  }
};

/** 生成按下 esc 的行为 */
const genEscFocus = (disabledEsc, onEscape, trigger) => e => {
  if (disabledEsc) return;
  if (onEscape) onEscape(e);
  if (trigger == null) {
    console.warn("未指定触发器，将不会聚焦触发器，您可以在调用 focusBagel 时传入选项 trigger 指定触发器，或者在触发触发器的时候调用函数 enter，如果您使用了选项 enter，您也可以设置 enter.selector 而不指定选项 trigger 或者调用函数 enter。");
    return;
  }
  focus(trigger);
};

const focusBagel = (rootNode, subNodes, options = {}) => {

  const {
    /** 指定可以聚焦的元素，聚焦 subNodes 内的元素 */
    manual,
    /** 是否循环，设置后，尾元素的下个焦点是头元素，头元素的上个焦点是尾元素 */
    loop,
    /** 自定义前进焦点函数 */
    isForward,
    /** 自定义后退焦点函数 */
    isBackward,
    /** 触发器，如果使用 focusBagel.enter 则不用设置，如果使用 enter.selector 则不用设置 */
    trigger,
    /** 触发触发器的配置 */
    enter = {},
    /** 触发退出触发器的配置 */
    exit = {},
    /** 按下 esc 的行为，如果未设置，则取 exit.on */
    onEscape,
    /** 聚焦子元素前是否先聚焦根元素，在根元素按下 enter 则进入子元素
     * TODO: cover 配置选项，例如是否锁 tab（默认不锁）
     */
    cover = false,
    /** TODO: 子元素锁 tab */
  } = options;

  const {
    selector: enterSelector,
    on: onEnter,
  } = enter;
  const {
    selector: exitSelector,
    on: onExit,
  } = exit;
  const {
    shiftTabNode: coverShiftTab
  } = Object.prototype.toString.call(cover) === "[object Object]" ? cover : {};

  /** 取消循环则设置头和尾焦点 */
  const isClamp = !(loop ?? true);

  // 自定义前进或后退焦点函数，则设置 manual 为 true
  const _manual = !!(isForward || isBackward || manual);

  /** 按下 esc 的反馈，如果未设置，则取触发退出的函数 */
  const _onEscape = onEscape ?? onExit;
  const disabledEsc = _onEscape === false || _onEscape == null;

  /** 触发打开焦点的元素 */
  let _trigger = element(trigger || enterSelector);

  const onEscFocus = genEscFocus(disabledEsc, _onEscape, _trigger);

  const _rootNode = element(rootNode);
  const _subNodes = subNodes.map(item => {
    let _item = element(item);
    if (_item == null) console.warn(`没有找到元素 ${item}。`);
    return _item;
  }).filter(item => item != null);
  const head = _subNodes[0];
  const tail = _subNodes.slice(-1)[0];

  if (head == null || tail == null)
    throw("至少需要包含两个可以聚焦的元素。");

  /** 活动元素在 subNodes 中的编号，打开 manual 生效 */
  let activeIndex = 0;

  // 在焦点循环中触发聚焦
  const handleFocus = _manual ? focusNextManually(_subNodes, rootNode, activeIndex, isClamp, cover, onEscFocus, isForward, isBackward) : focusNextKey(head, tail, rootNode, isClamp, cover, onEscFocus);
  _rootNode.addEventListener("keydown", handleFocus);

  if (coverShiftTab)
    coverShiftTab.addEventListener("keydown", handleCoverShiftTab(rootNode));

  // 触发器点击事件
  if (enterSelector && onEnter) {
    _trigger.addEventListener("click", e => {
      onEnter(e);
      tryFocus(head);
    })
  }

  // 跳出循环的触发器的点击事件
  if (exitSelector && onExit) {
    const exit = element(exitSelector);
    exit.addEventListener("click", e => {
      onExit(e);
      if (_trigger == null) {
        console.warn("未指定触发器，将不会聚焦触发器，您可以在调用 focusBagel 时传入选项 trigger 指定触发器，或者在触发触发器的时候调用函数 enter，如果您使用了选项 enter，您也可以设置 enter.selector 而不指定选项 trigger 或者调用函数 enter。");
        return;
      }
      focus(_trigger)
    });
  }

  return {
    /** 进入循环，聚焦 */
    enter() {
      _trigger = _trigger || getActiveElement();
      focus(head);
    },
    /** 退出循环，聚焦触发元素 */
    exit() {
      if (_trigger == null) {
        console.warn("未指定触发器，将不会聚焦触发器，您可以在调用 focusBagel 时传入选项 trigger 指定触发器，或者在触发触发器的时候调用函数 enter。");
        return;
      }
      focus(_trigger);
    },
    i: () => activeIndex,
  };
};

export default focusBagel;