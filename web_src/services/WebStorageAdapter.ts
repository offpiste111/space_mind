import { StorageService } from './StorageService';

export class WebStorageAdapter implements StorageService {
  private fileHandle: any = null;
  private currentFileName: string = '';

  isWebMode(): boolean {
    return true;
  }

  async init(): Promise<boolean> {
    console.log("WebStorageAdapter initialized");
    return true;
  }

  // 最近のファイル履歴からデータを読み込む
  async loadJsonByPath(path: string): Promise<any> {
    try {
      const dataStr = localStorage.getItem(`space_mind_data:${path}`);
      if (dataStr) {
        this.currentFileName = path;
        return JSON.parse(dataStr);
      }
      throw new Error(`File not found in browser storage: ${path}`);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // ファイル選択ダイアログの表示とロード
  async selectFileDialog(): Promise<any> {
    // 1. File System Access API をサポートしている場合
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        this.fileHandle = handle;
        this.currentFileName = handle.name;
        
        const file = await handle.getFile();
        const contents = await file.text();
        const data = JSON.parse(contents);

        this.updateRecentFiles(handle.name, data);
        return data;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return null; // キャンセル時
        }
        console.warn("File System Access API failed, falling back to input element", err);
      }
    }

    // 2. フォールバック: input[type="file"] を使用する
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        this.currentFileName = file.name;
        this.fileHandle = null; // inputタグ経由は直接の上書き保存用ハンドルを持てない
        
        try {
          const contents = await file.text();
          const data = JSON.parse(contents);
          this.updateRecentFiles(file.name, data);
          resolve(data);
        } catch (err) {
          console.error("Error reading file:", err);
          resolve(null);
        }
      };
      input.click();
    });
  }

  // データの保存
  async saveData(data: any): Promise<[boolean, string | null]> {
    // 1. ファイルハンドルがある場合は直接上書き保存を試みる
    if (this.fileHandle) {
      try {
        const writable = await this.fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        
        this.updateRecentFiles(this.currentFileName, data);
        return [true, this.currentFileName];
      } catch (err) {
        console.error("Error writing to file handle, falling back to download", err);
      }
    }

    // 2. ハンドルがない場合は Save As (新規ダウンロード保存)
    return this.saveAsData(data);
  }

  // 別名で保存（ダウンロード）
  async saveAsData(data: any): Promise<[boolean, string | null]> {
    const jsonStr = JSON.stringify(data, null, 2);

    // 1. File System Access API をサポートしている場合
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: this.currentFileName || 'space_mind_map.json',
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        this.fileHandle = handle;
        this.currentFileName = handle.name;

        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();

        this.updateRecentFiles(handle.name, data);
        return [true, handle.name];
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return [false, null]; // キャンセル時
        }
        console.warn("showSaveFilePicker failed, falling back to simple download", err);
      }
    }

    // 2. フォールバック: aタグのダウンロード機能
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = this.currentFileName || 'space_mind_map.json';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.updateRecentFiles(filename, data);
      return [true, filename];
    } catch (err) {
      console.error("Error downloading file:", err);
      return [false, null];
    }
  }

  // 最近使った履歴リストを取得
  async getRecentFiles(): Promise<string[]> {
    try {
      const recent = localStorage.getItem('space_mind_recent_list');
      return recent ? JSON.parse(recent) : [];
    } catch (e) {
      return [];
    }
  }

  private updateRecentFiles(fileName: string, data: any) {
    try {
      // データの保存
      localStorage.setItem(`space_mind_data:${fileName}`, JSON.stringify(data));

      // 履歴リストの更新
      const recent = localStorage.getItem('space_mind_recent_list');
      let list: string[] = recent ? JSON.parse(recent) : [];
      
      list = list.filter(name => name !== fileName);
      list.unshift(fileName);
      list = list.slice(0, 10); // 最大10個

      localStorage.setItem('space_mind_recent_list', JSON.stringify(list));
    } catch (e) {
      console.error("Error updating recent files in LocalStorage", e);
    }
  }

  // ファイルを開く (Web版ではリンクのみ対応)
  async openFile(filePath: string): Promise<boolean> {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      window.open(filePath, '_blank');
      return true;
    }
    throw new Error("Web版ではセキュリティの制限によりローカルファイルを直接開くことはできません。");
  }

  // フォルダを開く (Web版では非対応)
  async openFolder(folderPath: string): Promise<boolean> {
    throw new Error("Web版ではセキュリティの制限によりローカルフォルダを開くことはできません。");
  }

  // ファイル名選択 (Web版では入力プロンプトまたはアップロード)
  async selectAnyFile(): Promise<string> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        resolve(file ? file.name : "");
      };
      input.click();
    });
  }

  // フォルダ選択 (Web版では非対応)
  async selectFolder(): Promise<string> {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        return handle.name;
      } catch (err) {
        console.warn(err);
      }
    }
    throw new Error("Web版ではフォルダの直接選択はサポートされていません。");
  }

  // OGP画像の取得 (ブラウザから直接取得するとCORSエラーになるため、Favicon API または CORSプロキシを利用)
  async getOgpImage(url: string): Promise<string | null> {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    } catch (e) {
      console.error("Failed to parse URL for favicon:", e);
      return null;
    }
  }

  async importMarkdownDialog(): Promise<any> {
    alert("Web版ではMarkdownファイルのインポート機能はサポートされていません。デスクトップ版をご利用ください。");
    return null;
  }
}
