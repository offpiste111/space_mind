import { StorageService } from './StorageService';

declare const window: any;

export class EelStorageAdapter implements StorageService {
  private getEel() {
    return window.eel;
  }

  isWebMode(): boolean {
    return false;
  }

  async init(): Promise<boolean> {
    if (this.getEel()) {
      return await this.getEel().init()();
    }
    return false;
  }

  async loadJsonByPath(path: string): Promise<any> {
    return await this.getEel().load_json_by_path(path)();
  }

  async selectFileDialog(): Promise<any> {
    return await this.getEel().select_file_dialog()();
  }

  async saveData(data: any): Promise<[boolean, string | null]> {
    return await this.getEel().save_data(data)();
  }

  async saveAsData(data: any): Promise<[boolean, string | null]> {
    return await this.getEel().save_as_data(data)();
  }

  async getRecentFiles(): Promise<string[]> {
    return await this.getEel().get_recent_files()();
  }

  async openFile(filePath: string): Promise<boolean> {
    return await this.getEel().open_file(filePath)();
  }

  async openFolder(folderPath: string): Promise<boolean> {
    return await this.getEel().open_folder(folderPath)();
  }

  async selectAnyFile(): Promise<string> {
    return await this.getEel().select_any_file()();
  }

  async selectFolder(): Promise<string> {
    return await this.getEel().select_folder()();
  }

  async getOgpImage(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        this.getEel().get_ogp_image(url)((imgData: string | null) => {
          resolve(imgData);
        });
      } catch (err) {
        console.error("Error getting OGP via Eel:", err);
        resolve(null);
      }
    });
  }
}
