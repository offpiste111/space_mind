import React,{useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Drawer, Button, Input, List } from 'antd';

interface TreeDrawerProps {
  onSave: () => void;
  onSearch: (text: string) => any[];
  onNodeSelect: (node: any) => void;
  onFileSelect: () => void;
  currentFileName: string;
}

const TreeDrawer = forwardRef(({onSave, onSearch, onNodeSelect, onFileSelect}: TreeDrawerProps, ref:any) => {

const [openTreeDraw, setOpenTreeDraw] = useState(false);
const [searchText, setSearchText] = useState('');
const [searchResults, setSearchResults] = useState<Array<any>>([]);

// 検索テキストが変更されたときの処理
useEffect(() => {
  const results = onSearch(searchText);
  setSearchResults(results);
}, [searchText, onSearch]);

// 検索結果のアイテムがクリックされたときの処理
const handleResultClick = (node: any) => {
  onNodeSelect(node);
  setOpenTreeDraw(false); // 検索結果クリック後にDrawerを閉じる
};

useImperativeHandle(ref, () => ({
    showDrawer : () => {
        setOpenTreeDraw(true);
      }
}));

  const onClose = () => {
    setOpenTreeDraw(false);
  };

  const handleFileSelect = () => {
    onFileSelect();
  };

  return (
    <>
      <Drawer title="ノード検索" onClose={onClose} open={openTreeDraw}>
        <div style={{ marginBottom: 16 }}>
          <Button 
            onClick={handleFileSelect}
            style={{ width: '100%', marginBottom: 8 }}
          >
            ファイルを開く
          </Button>
        </div>
        <Input
          placeholder="ノード名を入力"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <List
          size="small"
          bordered
          dataSource={searchResults}
          style={{ 
            maxHeight: '300px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
          renderItem={item => (
            <List.Item 
              onClick={() => handleResultClick(item)}
              style={{ cursor: 'pointer' }}
              className="search-result-item"
            >
              {item.name}
            </List.Item>
          )}
        />
        <Button 
          type="primary" 
          onClick={onSave}
          style={{ marginTop: 16 }}
        >
          保存
        </Button>
      </Drawer>
    </>
  );
});

export default TreeDrawer;
