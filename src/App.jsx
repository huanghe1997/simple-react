import React, { useEffect, useState } from '../core/React.js';
const Foo = function () {
  const [count, setCount] = useState(10);
  const [data, setData] = useState(1000);
  function handleClick() {
    setCount((pre) => pre + 1);
  }
  function handleClick1() {
    setData((pre) => pre + 100);
  }
  useEffect(() => {
    return () => {
      console.log('清除副作用');
    };
  }, []);
  useEffect(() => {
    return () => {
      console.log('清除副作用');
    };
  }, [count]);
  return (
    <div>
      count:{count}
      <button onClick={handleClick}>+1</button>
      count:{data}
      <button onClick={handleClick1}>测试按钮</button>
    </div>
  );
};

function App() {
  return (
    <div id="app">
      <Foo></Foo>
    </div>
  );
}
export default App;
