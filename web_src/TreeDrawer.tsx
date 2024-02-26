import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Drawer } from 'antd';

const TreeDrawer = forwardRef((props:any, ref:any) => {

const [openTreeDraw, setOpenTreeDraw] = useState(false);

useImperativeHandle(ref, () => ({
    showDrawer : () => {
        setOpenTreeDraw(true);
      }
}));

  const onClose = () => {
    setOpenTreeDraw(false);
  };

  return (
    <>
      <Drawer title="Basic Drawer" onClose={onClose} open={openTreeDraw}>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </Drawer>
    </>
  );
});

export default TreeDrawer;