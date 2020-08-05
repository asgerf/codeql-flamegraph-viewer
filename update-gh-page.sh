set -e
CurrentBranch=$(git rev-parse --abbrev-ref HEAD)

if [[ $CurrentBranch != "main" ]]; then
  echo "Not on main"
  exit 1
fi

git checkout gh-pages
git merge main

yarn install
yarn build-gh-pages

cp dist/*.{js,css,html} ./docs/
git add docs/*.{js,css,html}
git commit -m 'Update gh-pages'
git push

git checkout $CurrentBranch
