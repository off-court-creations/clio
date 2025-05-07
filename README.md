# Clio

CLI tools for linking and managing a glossary for documentation.
Works well with [Vitepress](https://vitepress.dev/) or by itself.

`Clio` is not intended to be imported into code files.

`Clio` modifies markdown files in a folder, via terminal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![npm](https://img.shields.io/npm/v/@archway/clio)
![semantic-release](https://img.shields.io/badge/semver‑compatible-✓-brightgreen)

![Downloads](https://img.shields.io/npm/dw/@archway/clio)
![Stars](https://img.shields.io/github/stars/off-court-creations/clio?style=social)

![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?logo=github)

## Quick Start

```shell
npm i -g @archway/clio
```

*`cd` to the parent folder of your documentation project*

```shell
clio init
```

### Automatic Glossary Suggestions

```shell
clio suggest
```

### Add a glossary entry

```shell
clio add
```

### Propogate links to glossary

```shell
clio
```

## Reference

| Command | Purpose | Example |
|---------|---------|---------|
| **`clio init`** | Creates a clio project folder at the top directory of docs | `clio init` |
| **`clio suggest`** | Suggests words from user's docs to add to glossary  | `clio suggest` |
| **`clio add`** | Add a new glossary entry  | `clio add` |
| **`clio`** | Create and update glossary links | `clio` or `clio gloss` |
| **`clio rename`** | Rename glossary entries, recursively updating all docs pages | `clio rename` |
| **`clio search`** | Fuzzy find a definition with a substring | `clio search Variant` |
| **`clio stats`** | View at-a-glance stats about the project | `clio stats` |
| **`clio toc`** | Rebuilds the Glossary Table of Contents | `clio toc` |
| **`clio delink`** | Remove all md links to other local md files | `clio delink` |
| **`clio help`** | View syntax and help | `clio help` |

## Stabilty and Roadmap

Clio follows [Semantic Versioning](https://semver.org/) (semver).

- **Patch (`x.y.Z`)**: Bug fixes or internal improvements with no impact on usage.
- **Minor (`x.Y.z`)**: New features that don’t break existing behavior.
- **Major (`X.y.z`)**: Breaking changes to commands, options, or output formats.`

>The `config.json` created in the `.clio` folder when running
>
>```shell
>npm init
>```
>
>also contains a schema version number for potential future breaking data migrations.

## Contributing

`Clio` is authored by [0xbenc](https://github.com/0xbenc).

<div align="center"> <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Charles_Meynier_-_Clio%2C_Muse_of_History_-_2003.6.5_-_Cleveland_Museum_of_Art.tiff/lossy-page1-800px-Charles_Meynier_-_Clio%2C_Muse_of_History_-_2003.6.5_-_Cleveland_Museum_of_Art.tiff.jpg" alt="Clio, Muse of History by Charles Meynier" width="600"/> <br/> <sub><i>Charles Meynier – Clio, Muse of History (Cleveland Museum of Art)</i></sub> </div>
