"""Inicializador portátil; mantenha o terminal aberto durante a apresentação."""
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser

import uvicorn


def open_browser(port):
    url=f'http://127.0.0.1:{port}'
    for _ in range(60):
        try:
            with urllib.request.urlopen(url+'/api/health',timeout=1):
                webbrowser.open(url+'/html/login.html')
                return
        except OSError:
            time.sleep(.25)


if __name__=='__main__':
    first=int(os.environ.get('LABIELOS_PORT','8000'))
    port=None
    for candidate in range(first,first+20):
        with socket.socket() as sock:
            try:
                sock.bind(('127.0.0.1',candidate))
                port=candidate
                break
            except OSError:
                continue
    if port is None:
        print('Nenhuma porta livre. Defina LABIELOS_PORT com outra porta e tente novamente.')
        sys.exit(1)
    print(f'LABIELOS — demonstração local\nAcesse http://127.0.0.1:{port}/html/login.html\nPara encerrar, pressione Ctrl+C ou feche esta janela.\n')
    if '--no-browser' not in sys.argv:
        threading.Thread(target=open_browser,args=(port,),daemon=True).start()
    uvicorn.run('backend.app:app',host='127.0.0.1',port=port,log_level='info')
