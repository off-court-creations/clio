# Clio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI tools for linking and managing glossaries in markdown projects.
Works well with [Vitepress](https://vitepress.dev/) or by itself.
`Clio` is not intended to be imported directly into code.
`Clio` modifies markdown files in a folder.

## Quick Start

```shell
npm i -g @archway/clio
```

`cd` to the parent folder of your documentation project.

CLI commands run for all relevant markdown files within the folder.

| Command | Purpose | Example |
|---------|---------|---------|
| **`clio add`** | Add a new glossary entry  | `clio add` |
| **`clio`** | Create and update glossary links | `clio` or `clio gloss` |
| **`clio rename`** | Rename glossary entries, recursively updating all docs pages | `clio rename` |
| **`clio search`** | Fuzzy find a definition with a substring | `clio search Variant` |
| **`clio stats`** | View at-a-glance stats about the project | `clio stats` |
| **`clio help`** | View syntax and help | `clio help` |

## Stabilty and Roadmap

> ⚠️ **Heads up!**  
> This project is in **late-stage beta** — it's stable and actively used, but still evolving.  
> Expect **one final round of breaking changes** before we lock in version `1.0.0`.
>
> We’ll follow [semantic versioning](https://semver.org/), so major changes will be clearly versioned.  
> If you're integrating this into production workflows, consider pinning to an exact version (`0.x.y`) to avoid surprises.

## Contributing

`Clio` is authored by [0xbenc](https://github.com/0xbenc).

<div align="center"> <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Charles_Meynier_-_Clio%2C_Muse_of_History_-_2003.6.5_-_Cleveland_Museum_of_Art.tiff/lossy-page1-800px-Charles_Meynier_-_Clio%2C_Muse_of_History_-_2003.6.5_-_Cleveland_Museum_of_Art.tiff.jpg" alt="Clio, Muse of History by Charles Meynier" width="600"/> <br/> <sub><i>Charles Meynier – Clio, Muse of History (Cleveland Museum of Art)</i></sub> </div>
