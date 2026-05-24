import React from 'react';

interface HtmlNodeComponentProps {
  node: any;
}

const HtmlNodeComponent: React.FC<HtmlNodeComponentProps> = ({ node }) => {
  const { 
    name, 
    deadline, 
    priority, 
    urgency, 
    assignee, 
    icon_img,
    style_id = 1,
    type,
    url,
    file_path,
    folder_path
  } = node;

  // 高解像度化のための倍率
  const SCALE = 4;

  const isHtmlIssue = type === 'issue';
  const isHtmlTask = type === 'task';
  const isHtmlLink = type === 'link';
  const isHtmlFile = type === 'file';
  const isHtmlFolder = type === 'folder';
  const isHtmlNormal = type === 'normal';

  // 基本コンテナスタイル
  const baseContainerStyle: React.CSSProperties = {
    padding: `${15 * SCALE}px`,
    fontFamily: '"Noto Sans", "Noto Sans JP", sans-serif',
    color: '#333',
    pointerEvents: 'none',
    userSelect: 'none',
    boxSizing: 'border-box',
    backfaceVisibility: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden', // 角丸に沿わせるため
    willChange: 'transform',
    transform: 'translateZ(0)',
  };

  let specificStyle: React.CSSProperties = {};
  let backgroundElement: React.ReactNode = null;
  let leftBorder: React.ReactNode = null;

  // タイプごとのスタイル分岐
  let customImg = null;
  if (node.img && node.img !== 'new_node.png' && !node.img.startsWith('node_img/')) {
    customImg = node.img;
  } else if (icon_img && (icon_img === 'logo.png' || icon_img === './assets/logo.png')) {
    customImg = 'logo.png';
  }
  if (customImg && customImg.startsWith('./assets/')) {
    customImg = customImg.replace('./assets/', '');
  }
  const hasCustomImg = !!customImg;

  if (isHtmlIssue) {
    specificStyle = {
      background: hasCustomImg ? 'transparent' : 'white', // カスタム画像の場合は透明、それ以外は白
      borderRadius: `${20 * SCALE}px`, // 角丸を追加
      minWidth: `${300 * SCALE}px`,
      minHeight: `${200 * SCALE}px`,
      maxWidth: 'max-content',
      boxShadow: hasCustomImg ? 'none' : `0 ${4 * SCALE}px ${6 * SCALE}px rgba(0,0,0,0.1)`, // 他のノードと同様の影
    };
    backgroundElement = (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: hasCustomImg ? `url(./assets/${customImg})` : `url(./assets/issue${style_id}.png)`,
        backgroundSize: 'cover', // カスタム画像もカバーにして枠いっぱいに広げ角丸を適用
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1, 
        opacity: hasCustomImg ? 1.0 : 0.6, // カスタム画像の場合は半透明化しない
      }} />
    );
  } else if (isHtmlNormal) {
    const sId = style_id || 1;
    specificStyle = {
      background: 'white',
      border: `${2 * SCALE}px solid #4c9ac0`,
      borderRadius: `${10 * SCALE}px`,
      minWidth: `${200 * SCALE}px`,
      maxWidth: 'max-content',
      boxShadow: `0 ${4 * SCALE}px ${6 * SCALE}px rgba(0,0,0,0.1)`,
    };

    // 詳細なスタイル再現
    if (sId === 1) specificStyle.background = '#e1eef5';
    if (sId === 2) {
      specificStyle.border = `${3 * SCALE}px solid #ffc06e`;
      specificStyle.borderRadius = `${4 * SCALE}px`;
    }
    if (sId === 3) {
      specificStyle.background = `linear-gradient(-135deg, transparent ${14.14 * SCALE}px, #eeebcc 0)`;
      specificStyle.border = 'none';
      specificStyle.borderRadius = '0';
      backgroundElement = (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 0,
          height: 0,
          borderWidth: `0 ${20 * SCALE}px ${20 * SCALE}px 0`,
          borderStyle: 'solid',
          borderColor: `transparent transparent #4c9ac0 transparent`,
          boxShadow: `-${1 * SCALE}px ${1 * SCALE}px ${1 * SCALE}px rgba(0, 0, 0, 0.15)`
        }} />
      );
    }
    if (sId === 4) {
      specificStyle.background = '#b22222';
      specificStyle.color = '#ffffff';
      specificStyle.fontWeight = 'bold';
    }
    if (sId === 5) {
      specificStyle.background = '#ffebf0';
      specificStyle.backgroundImage = `radial-gradient(#fad6de 10%, transparent 25%), radial-gradient(#fad6de 10%, transparent 25%)`;
      specificStyle.backgroundPosition = `0 0, ${10 * SCALE}px ${10 * SCALE}px`;
      specificStyle.backgroundSize = `${20 * SCALE}px ${20 * SCALE}px`;
    }
    if (sId === 6) {
      specificStyle.border = `${3 * SCALE}px dashed #ffc3c3`;
      specificStyle.borderRadius = `${4 * SCALE}px`;
    }
  } else if (isHtmlTask || isHtmlLink || isHtmlFile || isHtmlFolder) {
    specificStyle = {
      background: '#f3f2f3',
      minWidth: `${200 * SCALE}px`,
      maxWidth: 'max-content',
      paddingLeft: (isHtmlLink || isHtmlFile || isHtmlFolder) ? `${55 * SCALE}px` : `${20 * SCALE}px`,
      alignItems: 'flex-start',
      textAlign: 'left',
    };
    leftBorder = (
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${10 * SCALE}px`,
        height: '100%',
        background: '#4c9ac0'
      }} />
    );
  }

  const nameStyle: React.CSSProperties = {
    fontSize: isHtmlIssue ? `${28 * SCALE}px` : `${18 * SCALE}px`,
    fontWeight: 'bold',
    marginBottom: `${8 * SCALE}px`,
    whiteSpace: 'pre',
    lineHeight: 1.2,
    textShadow: isHtmlIssue ? 
      `${2 * SCALE}px ${2 * SCALE}px 0 #fff, -${2 * SCALE}px -${2 * SCALE}px 0 #fff, ${2 * SCALE}px -${2 * SCALE}px 0 #fff, -${2 * SCALE}px ${2 * SCALE}px 0 #fff, 0 ${2 * SCALE}px 0 #fff, 0 -${2 * SCALE}px 0 #fff, ${2 * SCALE}px 0 0 #fff, -${2 * SCALE}px 0 0 #fff` 
      : 'none',
  };

  const infoStyle: React.CSSProperties = {
    fontSize: `${12 * SCALE}px`,
    color: '#666',
    marginTop: `${4 * SCALE}px`,
    display: 'flex',
    alignItems: 'center',
  };

  const icon_size = node.icon_size || 300;

  const iconStyle: React.CSSProperties = {
    maxWidth: '100%',
    height: `${(icon_size / 3) * SCALE}px`, // サイズを明示的に指定
    objectFit: 'contain',
    marginBottom: `${10 * SCALE}px`,
    display: 'block',
  };

  // SVGアイコンの再現
  const LinkIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke="#4c9ac0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  );

  const FileIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke="#4c9ac0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  const FolderIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke="#4c9ac0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  return (
    <div style={{ ...baseContainerStyle, ...specificStyle }} className={`node-html-content style-${style_id} type-${type}`}>
      {backgroundElement}
      {leftBorder}
      {isHtmlLink && <LinkIcon />}
      {isHtmlFile && <FileIcon />}
      {isHtmlFolder && <FolderIcon />}
      
      {icon_img && <img src={icon_img} alt="icon" style={iconStyle} />}
      
      <div style={nameStyle}>{name}</div>
      
      {deadline && (
        <div style={{ ...infoStyle, color: '#ff4d4f' }}>
          <span>📅 期限: {deadline}</span>
        </div>
      )}
      
      {priority !== undefined && priority !== null && (
        <div style={{ ...infoStyle, color: '#1890ff' }}>
          <span>⭐ 重要度: {'★'.repeat(priority)}</span>
        </div>
      )}
      
      {urgency !== undefined && urgency !== null && (
        <div style={{ ...infoStyle, color: '#52c41a' }}>
          <span>🔥 緊急度: {'★'.repeat(urgency)}</span>
        </div>
      )}
      
      {assignee && (
        <div style={infoStyle}>
          <svg xmlns="http://www.w3.org/2000/svg" width={14 * SCALE} height={14 * SCALE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 * SCALE, verticalAlign: 'middle' }}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>{assignee}</span>
        </div>
      )}

      {isHtmlLink && url && (
        <div style={{ ...infoStyle, color: '#4c9ac0', fontSize: `${10 * SCALE}px` }}>
          {url}
        </div>
      )}
      {(isHtmlFile && file_path) && (
        <div style={{ ...infoStyle, color: '#4c9ac0', fontSize: `${10 * SCALE}px` }}>
          {file_path}
        </div>
      )}
      {(isHtmlFolder && folder_path) && (
        <div style={{ ...infoStyle, color: '#4c9ac0', fontSize: `${10 * SCALE}px` }}>
          {folder_path}
        </div>
      )}
    </div>
  );
};

export default HtmlNodeComponent;
