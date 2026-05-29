import React from 'react';

interface HtmlNodeComponentProps {
  node: any;
}

// ノーマルノード用カラーパレット（NodeEditorと同一）
const BG_COLORS = [
  '#ddeeff', // 青系（デフォルト）
  '#ddffee', // 緑系
  '#fffadd', // 黄系
  '#ffeedd', // 橙系
  '#ffddee', // ピンク系
  '#eeddff', // 紫系
  '#f0f0f0', // グレー系
];
const PATTERN_COLORS = [
  '#4c9ac0', // 青系（デフォルト）
  '#3aaa6a', // 緑系
  '#c8a000', // 黄系
  '#d06020', // 橙系
  '#c04070', // ピンク系
  '#7040c0', // 紫系
  '#808080', // グレー系
];
// 強調スタイル用: 背景が濃く、模様が薄い（逆配色）
const EMPHASIS_BG_COLORS = [
  '#2255aa', // 青系（デフォルト）
  '#226644', // 緑系
  '#886600', // 黄系
  '#aa4400', // 橙系
  '#993366', // ピンク系
  '#553399', // 紫系
  '#444444', // グレー系
];
const EMPHASIS_PATTERN_COLORS = [
  '#d0e8ff', // 青系（デフォルト）
  '#ccffee', // 緑系
  '#fff8cc', // 黄系
  '#ffeedd', // 橙系
  '#ffd0e8', // ピンク系
  '#ead0ff', // 紫系
  '#e8e8e8', // グレー系
];

// ドット背景用: 背景色より少し濃いパステル
const DOT_PATTERN_COLORS = [
  '#bbd8f0', // 青系
  '#bbeecc', // 緑系
  '#f0e8aa', // 黄系
  '#f0ccaa', // 橙系
  '#f0bbcc', // ピンク系
  '#d8bbf0', // 紫系
  '#d0d0d0', // グレー系
];

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
    folder_path,
    node_bg_color = 0,
    node_pattern_color = 0,
    node_custom_bg_color = '#ddeeff',
  } = node;

  const bgIdx = typeof node_bg_color === 'number' ? Math.max(0, Math.min(7, node_bg_color)) : 0;
  const ptIdx = typeof node_pattern_color === 'number' ? Math.max(0, Math.min(7, node_pattern_color)) : 0;

  // 高解像度化のための倍率
  const SCALE = 4;

  const isHtmlIssue = type === 'issue';
  const isHtmlTask = type === 'task';
  const isHtmlLink = type === 'link';
  const isHtmlFile = type === 'file';
  const isHtmlFolder = type === 'folder';
  const isHtmlNormal = type === 'normal';

  let themeColor = '#4c9ac0'; // デフォルトの青色
  if (isHtmlFile) themeColor = '#52c41a'; // 緑色
  if (isHtmlFolder) themeColor = '#faad14'; // 黄色

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
      background: hasCustomImg ? 'transparent' : 'white',
      borderRadius: `${20 * SCALE}px`,
      minWidth: `${300 * SCALE}px`,
      minHeight: `${200 * SCALE}px`,
      maxWidth: 'max-content',
      boxShadow: hasCustomImg ? 'none' : `0 ${4 * SCALE}px ${6 * SCALE}px rgba(0,0,0,0.1)`,
    };
    backgroundElement = (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: hasCustomImg ? `url(./assets/${customImg})` : `url(./assets/issue${style_id}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1, 
        opacity: hasCustomImg ? 1.0 : 0.6,
      }} />
    );
  } else if (isHtmlNormal) {
    const sId = style_id || 1;

    // スタイルごとに色を解決
    // bgIdx=7の場合はカスタム色、強調は逆配色
    const bgColor = bgIdx === 7
      ? (node_custom_bg_color || '#ddeeff')
      : (sId === 4 ? EMPHASIS_BG_COLORS[bgIdx] : BG_COLORS[bgIdx]);
    // ptIdx=7の場合は背景色と同じ（模様なし）
    const ptColor = ptIdx === 7
      ? bgColor
      : (sId === 4 ? EMPHASIS_PATTERN_COLORS[ptIdx] : PATTERN_COLORS[ptIdx]);

    specificStyle = {
      background: bgColor,
      border: `${2 * SCALE}px solid ${ptColor}`,
      borderRadius: `${10 * SCALE}px`,
      minWidth: `${200 * SCALE}px`,
      maxWidth: 'max-content',
      boxShadow: `0 ${4 * SCALE}px ${6 * SCALE}px rgba(0,0,0,0.1)`,
      color: '#333',
    };

    if (sId === 1) {
      // シンプル: 薄い背景色 + 模様色の枠線
      specificStyle.background = bgColor;
      specificStyle.border = `${2 * SCALE}px solid ${ptColor}`;
      specificStyle.borderRadius = `${10 * SCALE}px`;
    } else if (sId === 3) {
      // メモ: 折れ曲がり角＋枠線
      const cutSize = 20 * SCALE;
      specificStyle.background = bgColor;
      specificStyle.border = `${2 * SCALE}px solid ${ptColor}`;
      specificStyle.borderRadius = '0';
      specificStyle.clipPath = `polygon(0 0, calc(100% - ${cutSize}px) 0, 100% ${cutSize}px, 100% 100%, 0 100%)`;
      backgroundElement = (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 0,
          height: 0,
          borderWidth: `0 ${20 * SCALE}px ${20 * SCALE}px 0`,
          borderStyle: 'solid',
          borderColor: `transparent transparent ${ptColor} transparent`,
          boxShadow: `-${1 * SCALE}px ${1 * SCALE}px ${1 * SCALE}px rgba(0, 0, 0, 0.15)`
        }} />
      );
    } else if (sId === 4) {
      // 強調: 濃い背景色 + 薄い模様色の枠線・テキスト
      specificStyle.background = bgColor;
      specificStyle.border = `${3 * SCALE}px solid ${ptColor}`;
      specificStyle.color = ptColor;
      specificStyle.fontWeight = 'bold';
      specificStyle.borderRadius = `${10 * SCALE}px`;
    } else if (sId === 5) {
      // ドット: 薄い背景 + ドット模様（ptIdx=7のとき模様なし）
      const dotColor = ptIdx === 7 ? bgColor : DOT_PATTERN_COLORS[ptIdx];
      specificStyle.background = bgColor;
      specificStyle.backgroundImage = `radial-gradient(${dotColor} 10%, transparent 25%), radial-gradient(${dotColor} 10%, transparent 25%)`;
      specificStyle.backgroundPosition = `0 0, ${10 * SCALE}px ${10 * SCALE}px`;
      specificStyle.backgroundSize = `${20 * SCALE}px ${20 * SCALE}px`;
      specificStyle.border = `${2 * SCALE}px solid ${ptColor}`;
      specificStyle.borderRadius = `${10 * SCALE}px`;
    } else if (sId === 6) {
      // 破線: 薄い背景 + 破線枠
      specificStyle.background = bgColor;
      specificStyle.border = `${3 * SCALE}px dashed ${ptColor}`;
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
        background: themeColor
      }} />
    );
  }

  // 強調スタイルのテキスト色を上書き
  const isEmphasis = isHtmlNormal && (style_id || 1) === 4;
  const textColorOverride = isEmphasis ? EMPHASIS_PATTERN_COLORS[ptIdx] : undefined;

  const nameStyle: React.CSSProperties = {
    fontSize: isHtmlIssue ? `${28 * SCALE}px` : `${18 * SCALE}px`,
    fontWeight: 'bold',
    marginBottom: `${8 * SCALE}px`,
    whiteSpace: 'pre',
    lineHeight: 1.2,
    color: textColorOverride,
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
    height: `${(icon_size / 3) * SCALE}px`,
    objectFit: 'contain',
    marginBottom: `${10 * SCALE}px`,
    display: 'block',
  };

  // SVGアイコンの再現
  const LinkIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  );

  const FileIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  const FolderIcon = () => (
    <svg style={{ position: 'absolute', left: `${10 * SCALE}px`, top: '50%', transform: 'translateY(-50%)', width: `${35 * SCALE}px`, height: `${35 * SCALE}px` }} viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const disabledStyle: React.CSSProperties = node.disabled ? {
    opacity: 0.3,
  } : {};

  return (
    <div style={{ ...baseContainerStyle, ...specificStyle, ...disabledStyle }} className={`node-html-content style-${style_id} type-${type}`}>
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
        <div style={{ ...infoStyle, color: themeColor, fontSize: `${10 * SCALE}px` }}>
          {url}
        </div>
      )}
      {(isHtmlFile && file_path) && (
        <div style={{ ...infoStyle, color: themeColor, fontSize: `${10 * SCALE}px` }}>
          {file_path}
        </div>
      )}
      {(isHtmlFolder && folder_path) && (
        <div style={{ ...infoStyle, color: themeColor, fontSize: `${10 * SCALE}px` }}>
          {folder_path}
        </div>
      )}
    </div>
  );
};

export default HtmlNodeComponent;
