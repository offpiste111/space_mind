
Here are the most important commands for working on this project:

### Install All Dependencies

```bash
npm install && pip install -r requirements.txt
```

### Run in Development Mode

Run these in two separate terminals.

- **Frontend:**
  ```bash
  npm run dev
  ```
- **Backend:**
  ```bash
  python main.py true
  ```

### Build Frontend for Production

```bash
npm run build
```

### Run in Production Mode

(Requires `npm run build` to be run first)

```bash
python main.py
```
