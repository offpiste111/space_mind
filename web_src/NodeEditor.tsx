import React,{useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Modal, Input, Button, Flex, Select, Upload, Slider, ColorPicker } from 'antd';
import { UploadOutlined, FolderOutlined } from '@ant-design/icons';
import _ from 'lodash';
import type { UploadProps } from 'antd';
import { eel } from './index';

interface ModalRef {
    showModal: (data: any) => void;
}

interface NodeEditorProps {
    onRefreshNode: (node: any) => void;
    onDeleteNode: (node: any) => void;
    onClose: () => void;
    open: boolean;
}

const NodeEditor = forwardRef<ModalRef, NodeEditorProps>((props, ref) => {
    const [contents, setContents] = useState("");
    const [styleId, setStyleId] = useState<number>(1);
    const [deadline, setDeadline] = useState<string>("");
    const [priority, setPriority] = useState<number | null>(null); // デフォルト: 未選択
    const [urgency, setUrgency] = useState<number | null>(null); // デフォルト: 未選択
    const [imageSize, setImageSize] = useState<number>(300); // デフォルト画像サイズ: 300px
    const [nodeType, setNodeType] = useState<string>("normal"); // デフォルト: ノーマル
    const [background, setBackground] = useState<string>("#010101"); // デフォルト: 白
    const [url, setUrl] = useState<string>(""); // リンクタイプ用のURL
    const [filePath, setFilePath] = useState<string>(""); // ファイルタイプ用のファイルパス
    const [folderPath, setFolderPath] = useState<string>(""); // フォルダタイプ用のフォルダパス
    
    interface Node {
        name: string;
        isNew?: boolean;
        style_id?: number;
        deadline?: string;
        priority?: number | null;
        urgency?: number | null;
        disabled?: boolean;
        icon_img?: string;
        icon_size?: number;
        type?: string;
        url?: string;
        file_path?: string;
        folder_path?: string;
        scale?: number;  // 3Dオブジェクトのスケール
        background?: string; // 背景色
    }
    
    const [editNode, setEditNode] = useState<Node | null>(null);
    const [iconImg, setIconImg] = useState<string>("");

    const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        showUploadList: false,
        beforeUpload: async (file) => {
            if (!file.type.startsWith('image/')) {
                return false;
            }
            const base64 = await getBase64(file);
            setIconImg(base64);
            return false;
        },
        customRequest: () => {},
    };

    useImperativeHandle(ref, () => ({
        showModal: (node: any) => {
            setContents(node.name);
            // style_idはnodeからそのまま取得する
            setStyleId(node.style_id || 1);
            setDeadline(node.deadline || "");
            setPriority(node.priority !== undefined ? node.priority : null);
            setUrgency(node.urgency !== undefined ? node.urgency : null);
            setIconImg(node.icon_img || "");
            setImageSize(node.icon_size || 300); // 保存されていたサイズがあれば取得、なければデフォルト値
            setNodeType(node.type || "normal"); // 保存されていたタイプがあれば取得、なければデフォルト値
            setBackground(node.background || "#010101"); // 保存されていた背景色があれば取得、なければデフォルト値
            setUrl(node.url || ""); // リンク用URL
            setFilePath(node.file_path || ""); // ファイルパス
            setFolderPath(node.folder_path || ""); // フォルダパス
            setEditNode(node);
        }
    }));

    const handleOk = () => {
        if (editNode){
            // 元のノードをディープコピーして、そのコピーに変更を適用する
            const nodeToUpdate = _.cloneDeep(editNode);
            
            nodeToUpdate.name = contents;
            nodeToUpdate.icon_img = iconImg;
            nodeToUpdate.icon_size = imageSize; // 画像サイズの保存
            nodeToUpdate.type = nodeType; // ノードタイプの保存
            
            // タイプ固有の属性を保存
            switch (nodeType) {
                case "normal":
                    nodeToUpdate.style_id = styleId;
                    // ノーマルタイプでは不要な属性を削除
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.file_path;
                    delete nodeToUpdate.folder_path;
                    delete nodeToUpdate.background;
                    break;
                case "issue":
                    nodeToUpdate.style_id = styleId;
                    nodeToUpdate.background = background;
                    // issueタイプでは不要な属性を削除
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.file_path;
                    delete nodeToUpdate.folder_path;
                    break;
                case "task":
                    nodeToUpdate.style_id = 1;
                    nodeToUpdate.deadline = deadline;
                    if (priority === null) {
                        delete nodeToUpdate.priority;
                    } else {
                        nodeToUpdate.priority = priority;
                    }
                    if (urgency === null) {
                        delete nodeToUpdate.urgency;
                    } else {
                        nodeToUpdate.urgency = urgency;
                    }
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.file_path;
                    delete nodeToUpdate.folder_path;
                    break;
                case "link":
                    nodeToUpdate.style_id = 1;
                    nodeToUpdate.url = url;
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.file_path;
                    delete nodeToUpdate.folder_path;
                    break;
                case "file":
                    nodeToUpdate.style_id = 1;
                    nodeToUpdate.file_path = filePath;
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.folder_path;
                    break;
                case "folder":
                    nodeToUpdate.style_id = 1;
                    nodeToUpdate.folder_path = folderPath;
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.file_path;
                    break;
                case "3dobject":
                    // 3Dオブジェクト用の属性を設定
                    nodeToUpdate.style_id = styleId;
                    nodeToUpdate.scale = editNode.scale || 1.0;
                    // 不要な属性を削除
                    delete nodeToUpdate.deadline;
                    delete nodeToUpdate.priority;
                    delete nodeToUpdate.urgency;
                    delete nodeToUpdate.url;
                    delete nodeToUpdate.file_path;
                    delete nodeToUpdate.folder_path;
                    delete nodeToUpdate.icon_img;
                    delete nodeToUpdate.icon_size;
                    break;
            }
            
            // 変更を適用したコピーを渡す
            props.onRefreshNode(nodeToUpdate);
        }
        props.onClose();
    };
  
    const handleCancel = () => {
        props.onClose();
        if (editNode && _.has(editNode, 'isNew') && editNode.isNew){
            props.onDeleteNode(editNode);
        }
    };

    const handleFileSelect = async () => {
        try {
            const selectedPath = await eel.select_any_file()();
            if (selectedPath) {
                setFilePath(selectedPath);
            }
        } catch (error) {
            console.error('Error selecting file:', error);
        }
    };

    const handleFolderSelect = async () => {
        try {
            const selectedPath = await eel.select_folder()();
            if (selectedPath) {
                setFolderPath(selectedPath);
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
        }
    };
    
    // タイプに応じた追加フィールドを表示する関数
    const renderTypeSpecificFields = () => {
        switch (nodeType) {
            case "normal":
                return null;
            case "issue":
                return (
                    <Flex gap="middle" align="center">
                        <div style={{ width: '80px' }}>背景色</div>
                        <ColorPicker
                            value={background}
                            onChange={(color) => setBackground(color.toHexString())}
                        />
                    </Flex>
                );
            case "task":
                return (
                    <>
                        <Flex gap="middle" align="center">
                            <div style={{ width: '80px' }}>期限</div>
                            <Input
                                style={{ flex: 1 }}
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </Flex>
                        <Flex gap="middle" align="center">
                            <div style={{ width: '80px' }}>重要度</div>
                            <Select
                                style={{ flex: 1 }}
                                value={priority}
                                onChange={(value) => setPriority(value)}
                                options={[
                                    { value: null, label: '未選択' },
                                    { value: 1, label: '最低' },
                                    { value: 2, label: '低' },
                                    { value: 3, label: '中' },
                                    { value: 4, label: '高' },
                                    { value: 5, label: '最高' },
                                ]}
                            />
                        </Flex>
                        <Flex gap="middle" align="center">
                            <div style={{ width: '80px' }}>緊急度</div>
                            <Select
                                style={{ flex: 1 }}
                                value={urgency}
                                onChange={(value) => setUrgency(value)}
                                options={[
                                    { value: null, label: '未選択' },
                                    { value: 1, label: '最低' },
                                    { value: 2, label: '低' },
                                    { value: 3, label: '中' },
                                    { value: 4, label: '高' },
                                    { value: 5, label: '最高' },
                                ]}
                            />
                        </Flex>
                    </>
                );
            case "link":
                return (
                    <Flex gap="middle" align="center">
                        <div style={{ width: '80px' }}>URL</div>
                        <Input
                            style={{ flex: 1 }}
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </Flex>
                );
            case "file":
                return (
                    <Flex gap="small">
                        <Input
                            placeholder="ファイルパス"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Button 
                            icon={<FolderOutlined rev="" />}
                            onClick={handleFileSelect}>
                            選択
                        </Button>
                    </Flex>
                );
            case "folder":
                return (
                    <Flex gap="small">
                        <Input
                            placeholder="フォルダパス"
                            value={folderPath}
                            onChange={(e) => setFolderPath(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Button 
                            icon={<FolderOutlined rev="" />}
                            onClick={handleFolderSelect}>
                            選択
                        </Button>
                    </Flex>
                );
            case "3dobject":
                return (
                    <Flex vertical gap="small">
                        <Flex gap="middle" align="center">
                            <div style={{ width: '80px' }}>モデル</div>
                            <Select
                                style={{ flex: 1 }}
                                value={styleId}
                                onChange={(value) => setStyleId(value)}
                                options={[
                                    { value: 1, label: 'Horse.glb' },
                                ]}
                            />
                        </Flex>
                        <Flex gap="middle" align="center">
                            <div style={{ width: '80px' }}>スケール</div>
                            <Flex vertical style={{ flex: 1 }}>
                                <Slider
                                    min={0.3}
                                    max={2.0}
                                    step={0.1}
                                    value={editNode?.scale || 1.0}
                                    onChange={(value) => {
                                        if (editNode) {
                                            const updatedNode = { ...editNode, scale: value };
                                            setEditNode(updatedNode);
                                        }
                                    }}
                                />
                            </Flex>
                        </Flex>
                    </Flex>
                );
            default:
                return null;
        }
    };

    return (
        <>
          <Modal 
            title="Edit Node" 
            open={props.open} 
            onOk={handleOk} 
            onCancel={handleCancel}
            footer={
              <Flex justify="space-between" align="center">
                {editNode && !editNode.isNew && (
                  <Flex gap="small">
                    <Button danger onClick={() => {
                      if (editNode) {
                        props.onDeleteNode(editNode);
                        props.onClose();
                      }
                    }}>
                      削除
                    </Button>
                    <Button onClick={() => {
                      if (editNode) {
                        // 元のノードをディープコピーして、そのコピーに変更を適用する
                        const nodeToUpdate = _.cloneDeep(editNode);
                        nodeToUpdate.disabled = !nodeToUpdate.disabled;
                        props.onRefreshNode(nodeToUpdate);
                        props.onClose();
                      }
                    }}>
                      {editNode.disabled ? '有効化' : '無効化'}
                    </Button>
                  </Flex>
                )}
                <Flex gap="small" style={{ marginLeft: editNode?.isNew ? 'auto' : 0 }}>
                  <Button onClick={handleCancel}>
                    キャンセル
                  </Button>
                  <Button type="primary" onClick={handleOk}>
                    OK
                  </Button>
                </Flex>
              </Flex>
            }
            afterOpenChange={(visible) => {
              if (visible) {
                setTimeout(() => {
                  const textarea = document.querySelector('.ant-modal textarea') as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.focus();
                  }
                }, 100);
              }
            }}
          >
          <Flex vertical gap="small">
            
            <Flex gap="middle" align="center">
              <div style={{ width: '80px' }}>タイプ</div>
              <Select
                style={{ flex: 1 }}
                value={nodeType}
                onChange={(value) => setNodeType(value)}
                options={[
                  { value: "normal", label: 'ノーマル' },
                  { value: "issue", label: '課題' },
                  { value: "task", label: 'タスク' },
                  { value: "link", label: 'リンク' },
                  { value: "file", label: 'ファイル' },
                  { value: "folder", label: 'フォルダ' },
                  { value: "3dobject", label: '3Dオブジェクト' },
                ]}
              />
            </Flex>
            <Input.TextArea 
              placeholder="Contents" 
              value={contents} 
              onChange={(e) => setContents(e.target.value)}
              autoSize={{ minRows: 3, maxRows: 6 }}
              onPressEnter={(e) => {
                if (e.shiftKey) {
                  e.preventDefault();
                  handleOk();
                }
              }}
            />
            {/* スタイル選択 */}
            {(nodeType === "normal" || nodeType === "issue") ? (
              <Flex gap="middle" align="center">
                <div style={{ width: '80px' }}>スタイル</div>
                <Select
                  style={{ flex: 1 }}
                  value={styleId}
                  onChange={(value) => setStyleId(value)}
                  options={[
                    { value: 1, label: 'スタイル1' },
                    { value: 2, label: 'スタイル2' },
                    { value: 3, label: 'スタイル3' },
                    { value: 4, label: 'スタイル4' },
                    { value: 5, label: 'スタイル5' },
                    { value: 6, label: 'スタイル6' },
                  ]}
                />
              </Flex>
            ) : nodeType !== "3dobject" && (
              <Flex gap="middle" align="center">
                <div style={{ width: '80px' }}>スタイル</div>
                <div style={{ flex: 1 }}>スタイル1 (固定)</div>
              </Flex>
            )}

            {/* アイコン選択（3dobject以外で表示） */}
            {nodeType !== "3dobject" && (
              <Flex gap="middle" align="start">
                <div style={{ width: '80px' }}>アイコン</div>
                <Flex vertical style={{ flex: 1 }}>
                  <Upload.Dragger {...uploadProps} style={{ padding: '6px', height: '70px', minHeight: 'auto' }}>
                      <p className="ant-upload-drag-icon" style={{ marginTop: '2px', marginBottom: '2px' }}>
                          <UploadOutlined rev="" style={{ fontSize: '16px' }} />
                      </p>
                      <p className="ant-upload-text" style={{ fontSize: '11px', marginBottom: '2px', lineHeight: '1.2' }}>クリックまたはドラッグで画像をアップロード</p>
                  </Upload.Dragger>
                  
                  {(iconImg || imageSize !== 300) && (
                    <Flex vertical style={{ marginTop: '8px' }}>
                      <Flex align="center" style={{ marginBottom: '4px' }}>
                        <div style={{ width: '360px', fontSize: '12px' }}>画像サイズ:</div>
                        <div style={{ marginLeft: '8px', fontSize: '12px' }}>{imageSize}px</div>
                      </Flex>
                      <Slider
                        min={150}
                        max={1000}
                        value={imageSize}
                        onChange={(value) => setImageSize(value)}
                      />
                    </Flex>
                  )}
                  
                  {iconImg && (
                      <img src={iconImg} alt="Node icon" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', marginTop: '8px' }} />
                  )}
                </Flex>
              </Flex>
            )}
            
            {renderTypeSpecificFields()}
            
          </Flex>
          </Modal>
        </>
      );
});

export default NodeEditor;
