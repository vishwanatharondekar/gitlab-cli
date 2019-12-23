# How to run this

Change url and token in Dockerfile

```bash
docker build . -t gitlab-cli
docker run -v $PWD:/home -ti --rm gitlab-cli merge-request -b docs/swagger -t v1.3.0 -v -a USERNAME -m MR_Title
```

## Usage with alias

```bash
echo "alias glcmr='docker run -v $PWD:/home -ti --rm gitlab-cli merge-request'" >> ~/.bashrc
glcmr -b docs/swagger -t v1.3.0 -v -a USERNAME -m MR_Title
```
