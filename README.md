# Plexo

**Plexo** synchronizes your `.prettierrc`, `.gitignore`, and other configs from a central source to your projects. 

## Quick Start
```bash
# 1. Install
npm install -g plexo

# 2. Setup (creates plexo.config.json)
plexo init

# 3. Sync configs
plexo sync
```

## Config (`plexo.config.json`)
```json
{
  "sourceDir": "./my-configs",
  "variables": {
    "AUTHOR": "CodeTease"
  }
}
```

> You also need **Python** to run Plexo.

*(I don't know if Python is necessary, but it works though.)*

## License

This project is under the **MIT License**.
