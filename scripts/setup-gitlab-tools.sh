#!/bin/sh
# Spouští se pomocí `. ./scripts/setup-gitlab-tools.sh` v dočasném Linux
# kontejneru GitLabu. Nikdy ho nepoužívej k instalaci nástrojů na svém počítači.
set -eu

if [ "$(uname -s)" != Linux ]; then
  echo 'Tento instalační skript je pouze pro dočasný Linux CI kontejner.' >&2
  exit 1
fi

ci_node_version=$(cat .node-version)
ci_bun_version=$(cat .bun-version)
case "$(uname -m)" in
  x86_64) ci_node_arch=x64 ;;
  aarch64) ci_node_arch=arm64 ;;
  *) echo 'Nepodporovaná architektura CI.' >&2; exit 1 ;;
esac

# Oficiální Node archiv kontrolujeme proti jeho publikovanému SHA-256.
# Nástroje zůstanou v /tmp tohoto jobu, nikoli v repozitáři nebo artefaktu.
ci_tools_dir=$(mktemp -d /tmp/mam-se-ci-tools.XXXXXX)
ci_node_archive="node-v${ci_node_version}-linux-${ci_node_arch}.tar.gz"
ci_node_url="https://nodejs.org/dist/v${ci_node_version}"
curl --fail --silent --show-error --location --retry 2 --max-time 180 \
  "$ci_node_url/$ci_node_archive" -o "$ci_tools_dir/$ci_node_archive"
curl --fail --silent --show-error --location --retry 2 --max-time 60 \
  "$ci_node_url/SHASUMS256.txt" -o "$ci_tools_dir/SHASUMS256.txt"
ci_node_checksum=$(awk -v name="$ci_node_archive" '$2 == name { print $1 "  " $2 }' "$ci_tools_dir/SHASUMS256.txt")
test -n "$ci_node_checksum"
(cd "$ci_tools_dir" && printf '%s\n' "$ci_node_checksum" | sha256sum --check -)
tar -xzf "$ci_tools_dir/$ci_node_archive" --strip-components=1 -C "$ci_tools_dir"
export PATH="$ci_tools_dir/bin:$PATH"
npm install --global --prefix "$ci_tools_dir" --no-audit --no-fund "bun@$ci_bun_version"

# Místo nenápadného použití jiné verze má chybná příprava job zastavit.
test "$(node --version)" = "v$ci_node_version"
test "$(bun --version)" = "$ci_bun_version"
node --version
bun --version
