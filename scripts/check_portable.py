"""Verifica o ZIP extraído e executado sem Python global, só com seu runtime."""
import hashlib
import http.cookiejar
import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
target=Path(tempfile.mkdtemp(prefix='portable-check-',dir=ROOT/'.runtime')).resolve()
assert target.parent==(ROOT/'.runtime').resolve()
with zipfile.ZipFile(ROOT/'dist/LABIELOS-APRESENTACAO-Windows-x64.zip') as archive:
    for name in archive.namelist():
        assert (target/name).resolve().is_relative_to(target)
    archive.extractall(target)
project=target/'LABIELOS'
assert not (project/'data/labielos.sqlite3').exists()
for directory in ('html','css','js','content'):
    for original in (ROOT/directory).rglob('*'):
        if original.is_file():
            assert original.read_bytes()==(project/original.relative_to(ROOT)).read_bytes(),original
assert (ROOT/'index.html').read_bytes()==(project/'index.html').read_bytes()
python=project/'.runtime/python/python.exe'
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}'


def start():
    proc=subprocess.Popen([str(python),'run.py','--no-browser'],cwd=project,env={**os.environ,'LABIELOS_PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(120):
        if proc.poll() is not None:
            raise RuntimeError('Servidor portátil encerrou antes de iniciar.')
        try:
            with urllib.request.urlopen(base+'/api/health',timeout=1) as r:
                assert json.load(r)['database']=='sqlite'
            return proc
        except OSError:
            time.sleep(.1)
    proc.terminate()
    raise RuntimeError('Servidor portátil não iniciou.')


def call(opener,path,data=None,method=None):
    request=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'},method=method)
    with opener.open(request,timeout=10) as r:
        return json.load(r)


proc=start()
try:
    for user,role,tipo in [('admin.fabrica','admin','fabricante'),('funcionario.fabrica','member','fabricante'),('admin.solicitante','admin','organizacao'),('funcionario.solicitante','member','organizacao')]:
        opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        call(opener,'/api/auth/login',{'email':user+'@labielos.test','senha':'Demo@12345'})
        me=call(opener,'/api/me')
        assert me['memberships'][0]['role']==role
        assert me['memberships'][0]['organization_type']==tipo
    s=call(opener,'/api/solicitacoes',{'solicitacao':'Teste portátil','categoria':'Órtese','descricao':'Teste de persistência em outro diretório'})
    protocol=s['protocolo'].replace('#','%23')
    assert s['protocolo']=='#0004'
    with urllib.request.urlopen(base+'/html/login.html') as response:
        assert response.read()==(ROOT/'html/login.html').read_bytes()
    proc.terminate()
    proc.wait(timeout=10)
    proc=start()
    assert call(opener,'/api/solicitacoes/'+protocol)['solicitacao']=='Teste portátil'
    print('OK: ZIP extraído em outro caminho, Python próprio, quatro perfis, front-end idêntico, criação de banco e persistência após reiniciar.')
    print('Pasta verificada:',project)
finally:
    proc.terminate()
    proc.wait(timeout=10)
