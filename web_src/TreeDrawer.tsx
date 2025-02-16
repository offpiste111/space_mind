import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Drawer, Button } from 'antd';

interface TreeDrawerProps {
  onSave: () => void;
}

const TreeDrawer = forwardRef(({onSave}: TreeDrawerProps, ref:any) => {

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
        <Button 
          type="primary" 
          onClick={onSave}
          style={{ marginBottom: 16 }}
        >
          保存
        </Button>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </Drawer>
    </>
  );
});

export default TreeDrawer;
