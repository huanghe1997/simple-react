
//创建TextEl
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      //这个必须是nodeValue，否则构建dom节点时无法添加文本
      nodeValue: text,
      children: []
    }
  }
};
//创建元素
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child => {
        const isTextNode = typeof child === "string" || typeof child === "number";
        return isTextNode === true ? createTextElement(child) : child;
      })
    }
  }
};

let wipRoot = null;// work in process
let currentRoot = null;
let deletions = [];//收集一下要删除的节点
let wipFiber = null;//全局变量存储要更新的节点
//动态渲染节点
function render(el, container) {

  wipRoot = {
    dom: container,
    props: {
      children: [el],
    }
  };
  nextWorkOfUnit = wipRoot;
};

//任务调度器
let nextWorkOfUnit = null;//当前任务单元,在render时进行赋值
function workLoop(deadline) {

  let shouldYield = false;
  while (!shouldYield && nextWorkOfUnit !== null) {
    //执行任务,渲染dom 
    if (nextWorkOfUnit) {
      nextWorkOfUnit = performWorkOfUnit(nextWorkOfUnit);//执行完当前任务返回下一个任务
      //找到更新的结束点；
      if (wipRoot?.sibling?.type === nextWorkOfUnit?.type) {
        nextWorkOfUnit = null;
      }
    }

    //如果没有下一个节点，代表链表处理完毕
    if (!nextWorkOfUnit && wipRoot) {
      commitRoot();
    }
    //没有剩余时间时就结束循环
    if (deadline.timeRemaining() < 1) {
      shouldYield = true;
    }
  }
  requestIdleCallback(workLoop);
};


//全部提交
function commitRoot() {
  deletions.forEach(commitDeletion);
  commitWork(wipRoot.child);//为啥不是root?因为root根节点已经在页面中
  //在这里处理useEffect
  commitEffectHooks();
  currentRoot = wipRoot; //当前dom根
  wipRoot = null;//设置成null，渲染只执行一次
  deletions = [];
}

function commitEffectHooks() {

  //递归处理当前节点下的effect
  function run(fiber) {
    if (!fiber) return;

    // 不存在旧的节点就直接调用
    if (!fiber.alternate) {
      // fiber.effectHook?.callback();

      fiber.effectHooks?.forEach((hook) => hook.cleanUp = hook.callback());

    } else {
      //update
      //deps有没有改变
      fiber.effectHooks?.forEach((newHook, index) => {
        let oldHook = fiber.alternate?.effectHooks[index];
        //判断[...]中的监听是否发生变化
        const needUpdate = oldHook && oldHook.deps?.some((oldDep, i) => {
          return oldDep !== newHook.deps[i];
        })
        needUpdate && (newHook.cleanUp = newHook.callback());
      });


    }

    run(fiber.child);
    run(fiber.sibling);
  }
  //在他之前调用cleanUp,清除副作用
  function runCleanUp(fiber) {
    if (!fiber) return;
    //为什么是alternate?;
    fiber.alternate?.effectHooks?.forEach((hook) => {
      if (hook.deps.length > 0) {
        hook.cleanUp && hook.cleanUp();
      }

    })
    runCleanUp(fiber.child);
    runCleanUp(fiber.sibling);
  }
  runCleanUp(wipRoot);
  run(wipRoot);
}

function commitDeletion(fiber) {

  if (fiber.dom) {
    let fiberParent = fiber.parent;
    //这里为什么用循环？函数式组件要进行拆盒。
    while (!fiberParent.dom) {
      fiberParent = fiberParent.parent;
    }
    fiberParent.dom.removeChild(fiber.dom);//1.fiber为函数时没有dom;2.fiber的父级为函数组件。
  } else {
    commitDeletion(fiber.child);
  }

  // let parentDom = fiber.parent.dom;

}
function commitWork(fiber) {
  if (!fiber) return;
  let fiberParent = fiber.parent;
  //这里为什么用循环？函数式组件要进行拆盒。
  while (!fiberParent.dom) {
    fiberParent = fiberParent.parent;
  }
  if (fiber.effectTag === "update") {
    updateProps(fiber.dom, fiber.props, fiber.alternate?.props);
  } else if (fiber.effectTag === "placement") {
    //当前节点添加到父级上
    if (fiber.dom) {
      fiberParent.dom.append(fiber.dom);
    }
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
requestIdleCallback(workLoop);

//进一步封装
function createDom(type) {
  return type !== "TEXT_ELEMENT" ? document.createElement(type) : document.createTextNode("")
}
function updateProps(dom, props, oldProps) {
  //1 .new 没有，old 有  删除
  Object.keys(oldProps).forEach(key => {
    if (oldProps !== "children") {
      if (!(key in props)) {
        dom.removeAttribute(key);
      }
    }
  })
  //2.new 有,old 有 
  //3.new 有，old 没有
  Object.keys(props).forEach((key) => {
    if (key !== "children") {
      if (props[key] !== oldProps[key]) {
        if (key.startsWith("on")) {
          const eventType = key.slice(2).toLowerCase();
          dom.removeEventListener(eventType, oldProps[key]);

          dom.addEventListener(eventType, props[key]);

        } else {
          dom[key] = props[key];
        }
      }

    };
  });
}
function reconcileChildren(fiber, children) {
  //fiber的老的孩子节点,第一个为app节点。
  let oldFiber = fiber.alternate?.child;
  let preChild = {};
  children.forEach((child, index) => {
    const isSameType = oldFiber && oldFiber.type === child.type;
    let newFiber = null;
    if (isSameType) {
      //update
      newFiber = {
        type: child.type,
        props: child.props,
        child: null,
        parent: fiber,
        sibling: null,
        dom: oldFiber.dom,//用之前的dom
        effectTag: "update",
        alternate: oldFiber,
      }
    } else {
      if (child) {
        newFiber = {
          type: child.type,
          props: child.props,
          child: null,
          parent: fiber,
          sibling: null,
          dom: null,
          effectTag: "placement"
        };
      }

      //删除节点的逻辑，获取老的节点，老的节点就是我们要删除的节点
      if (oldFiber) {
        deletions.push(oldFiber);
      }
    }

    //处理第二个孩子得情况下。
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      fiber.child = newFiber;

    } else {
      preChild.sibling = newFiber;
    }
    if (newFiber) {
      preChild = newFiber;
    };
  });

}
//处理函数式组件
function updateFunctionComponent(fiber) {
  stateHooks = [];
  stateHookIndex = 0;

  effectHooks = [];
  // 存一下要更新的节点
  wipFiber = fiber;
  //拆箱
  const children = [fiber.type(fiber.props)];
  //转换链表设置好指针
  reconcileChildren(fiber, children);
}
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    //创建dom
    let dom = (fiber.dom = createDom(fiber.type));
    // fiber.parent.dom.append(dom);
    //处理props
    updateProps(dom, fiber.props, {});
  }
  const children = fiber.props.children;
  reconcileChildren(fiber, children);
}
function performWorkOfUnit(fiber) {
  const isFunctionComponent = typeof fiber.type === 'function';
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber);
  }
  //返回下一个要执行的任务
  if (fiber.child) {
    return fiber.child;
  };
  // if (fiber.sibling) {
  //   return fiber.sibling;
  // }

  //循环，找到父级的兄弟节点,
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }
}

function update() {
  let currentFiber = wipFiber;
  return function () {
    wipRoot = {
      ...currentFiber,
      alternate: currentFiber,
    }
    // wipRoot = {
    //   dom: currentRoot.dom,
    //   props: currentRoot.props,
    //   alternate: currentRoot,
    // };
    nextWorkOfUnit = wipRoot;
  }


}

// 实现useState
let stateHooks;
let stateHookIndex;
export function useState(initial) {
  let currentFiber = wipFiber;//获取当前要更新的节点
  let oldHook = currentFiber.alternate?.stateHooks[stateHookIndex];
  const stateHook = {
    state: oldHook ? oldHook.state : initial,
    queue: oldHook ? oldHook.queue : [],
  };
  stateHooks.push(stateHook);
  stateHookIndex++;
  currentFiber.stateHooks = stateHooks;

  //批量处理actions
  let actions = stateHook.queue;
  actions.forEach(actions => { stateHook.state = actions(stateHook.state) });
  stateHook.queue = [];

  function setState(action) {
    //避免传入的state与当前的state相同，造成视图重新渲染；
    let eagerState = typeof action === "function" ? action(stateHook.state) : action;
    if (eagerState === stateHook.state) {
      return;
    }

    //重新赋值
    // stateHook.state = action(stateHook.state);

    stateHook.queue.push(typeof action === "function" ? action : () => action);
    wipRoot = {
      ...currentFiber,
      alternate: currentFiber,
    }
    nextWorkOfUnit = wipRoot;
  }
  return [stateHook.state, setState];
}

//实现useEffect
// 调用时机，在React完成dom渲染之后，在浏览器绘制之前。
let effectHooks;//存在多个useEffect时
export function useEffect(callback, deps) {
  const effectHook = {
    callback,
    deps,
    cleanUp: undefined,
  }
  effectHooks.push(effectHook);
  wipFiber.effectHooks = effectHooks;
}
const React = {
  createElement,
  render,
  update,
  useState,
  useEffect
}
export default React;