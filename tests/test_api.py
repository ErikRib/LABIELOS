"""Testes de integração: banco temporário real, sessões e fluxo completo."""
import os
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

TEMP = tempfile.TemporaryDirectory(prefix='labielos-tests-')
os.environ['LABIELOS_DATA_DIR'] = TEMP.name

from fastapi.testclient import TestClient
from backend.app import app
from backend.db import connect, get, initialize


class ApiTests(unittest.TestCase):
    def setUp(self):
        with connect(True) as con:
            for table in ('records','sessions','files','counters','metadata'):
                con.execute('DROP TABLE IF EXISTS '+table)
        initialize()
        self.client = TestClient(app)
        self.factory = self.login('funcionario.fabrica')
        self.client_org = self.login('funcionario.solicitante')
        self.admin = self.login('admin.fabrica')

    def login(self, name):
        client = TestClient(app)
        r = client.post('/api/auth/login',json={'email':name+'@labielos.test','senha':'Demo@12345'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn('HttpOnly',r.headers['set-cookie'])
        return client

    def post(self,client,action,data=None,code=200):
        r=client.post('/api/solicitacoes/%230001/'+action,json=data) if data is not None else client.post('/api/solicitacoes/%230001/'+action)
        self.assertEqual(r.status_code,code,r.text)
        return r.json()

    def start(self,origin='doacao'):
        self.post(self.factory,'aceitar')
        return self.post(self.factory,'iniciar-producao',dict(impressora_id='impressora-1',origem_material=origin,material_id='material-1',especificacao='500 g PLA',endereco_id='sede-demo'))

    def test_four_profiles_and_admin_permissions(self):
        for name,role,tipo in [('admin.fabrica','admin','fabricante'),('funcionario.fabrica','member','fabricante'),('admin.solicitante','admin','organizacao'),('funcionario.solicitante','member','organizacao')]:
            me=self.login(name).get('/api/me').json()
            self.assertEqual(me['memberships'][0]['role'],role)
            self.assertEqual(me['memberships'][0]['organization_type'],tipo)
            self.assertNotIn('password_hash',me['user'])
        self.assertEqual(self.factory.get('/api/organizations/fabrica-demo').status_code,403)
        self.assertEqual(len(self.admin.get('/api/organizations/fabrica-demo/members').json()),2)
        self.assertEqual(self.client.get('/api/me').status_code,401)
        self.assertEqual(self.client_org.get('/api/impressoras').status_code,403)

    def test_donation_workflow_and_persistence(self):
        s=self.start()
        self.assertEqual(s['status'],'Em produção')
        self.assertEqual(self.factory.get('/api/impressoras').json()[0]['status'],'Em uso')
        self.post(self.factory,'concluir-producao',dict(quantidade_usada=100),422)
        with connect() as con:
            self.assertEqual(get(con,'materiais','material-1')['quantidade'],10)
            self.assertEqual(get(con,'solicitacoes','#0001')['status'],'Em produção')
        s=self.post(self.factory,'concluir-producao',dict(quantidade_usada=.5))
        self.assertEqual(s['status'],'Pronta para retirada')
        self.assertEqual(self.factory.get('/api/impressoras').json()[0]['status'],'Disponível')
        self.post(self.client_org,'reprovar',dict(motivo='Ajustar encaixe'))
        self.assertEqual(self.factory.get('/api/impressoras').json()[0]['status'],'Em uso')
        self.post(self.factory,'concluir-producao',dict(quantidade_usada=.2))
        s=self.post(self.client_org,'aprovar')
        self.assertEqual(s['status'],'Concluída')
        self.assertTrue(s['concluida_em'])
        self.assertAlmostEqual(s['producao']['material']['quantidade_usada'],.7)
        with connect() as con:
            self.assertEqual(get(con,'materiais','material-1')['quantidade'],9.3)
        initialize()  # reiniciar nunca restaura os dados já alterados
        self.assertEqual(TestClient(app).post('/api/auth/login',json={'email':'admin.solicitante@labielos.test','senha':'Demo@12345'}).status_code,200)
        self.assertEqual(self.client_org.get('/api/solicitacoes/%230001').json()['status'],'Concluída')
        partner=self.client_org.get('/api/parceiros').json()[0]
        self.assertEqual(partner['concluidas_com_voce'],1)
        self.assertEqual(len(self.client_org.get('/api/solicitacoes/%230001/historico').json()),7)

    def test_requester_material_and_return_to_queue(self):
        self.post(self.factory,'aceitar')
        self.post(self.factory,'devolver')
        self.assertEqual(len(self.factory.get('/api/fila').json()),3)
        s=self.start('solicitante')
        self.assertEqual(s['status'],'Aguardando material')
        self.post(self.factory,'concluir-producao',{},409)
        self.post(self.factory,'material-recebido')
        self.post(self.factory,'concluir-producao',{})
        self.post(self.client_org,'aprovar')

    def test_atomic_acceptance(self):
        def accept(client):
            return client.post('/api/solicitacoes/%230001/aceitar').status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(accept,[self.factory,self.admin]))
        self.assertEqual(sorted(codes),[200,409])
        self.assertEqual(len(self.factory.get('/api/solicitacoes/%230001/historico').json()),2)

    def test_upload_download_edit_and_history(self):
        content=b'solid demo\nendsolid demo'
        r=self.client_org.post('/api/solicitacoes',data=dict(solicitacao='Peça teste',categoria='Órtese',descricao='Teste de arquivo',prioridade='Alta'),files={'arquivo3d':('modelo.stl',content,'application/octet-stream')})
        self.assertEqual(r.status_code,201,r.text)
        path='/api/solicitacoes/'+r.json()['protocolo'].replace('#','%23')
        self.assertEqual(self.client_org.get(path+'/arquivo3d').content,content)
        self.assertEqual(self.client.get(path+'/arquivo3d').status_code,401)
        self.assertEqual(self.client_org.patch(path,json={'solicitacao':'Peça editada'}).json()['solicitacao'],'Peça editada')
        self.assertEqual(self.client_org.patch(path,json={'status':'Concluída'}).status_code,409)
        r=self.client_org.post(path+'/historico',data={'mensagem':'Medidas'},files={'arquivo':('medidas.txt',b'medidas')})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.client_org.get(r.json()['anexo']['url']).content,b'medidas')
        r=self.client_org.post('/api/solicitacoes',data=dict(solicitacao='Peça',categoria='Teste',descricao='Teste'),files={'arquivo3d':('mal.exe',b'exe')})
        self.assertEqual(r.status_code,422)

    def test_registration_approval_and_removal(self):
        data=dict(nome='Novo',sobrenome='Membro',email='novo@teste.test',senha='Nova@12345',tipo='fabricante',vinculo='existente',termos=True,organizacao_id='fabrica-demo',justificativa='Apresentação')
        self.assertEqual(self.client.post('/api/auth/register',json=data).status_code,201)
        self.assertEqual(self.client.post('/api/auth/login',json={'email':data['email'],'senha':data['senha']}).status_code,403)
        pending=self.admin.get('/api/organizations/fabrica-demo/requests').json()[0]
        base='/api/organizations/fabrica-demo/'
        self.assertEqual(self.admin.post(base+'requests/'+pending['membership_id'],json={'approve':True}).status_code,200)
        self.assertEqual(self.client.post('/api/auth/login',json={'email':data['email'],'senha':data['senha']}).status_code,200)
        self.assertEqual(self.admin.delete(base+'members/'+pending['membership_id']).status_code,204)
        self.assertEqual(self.client.get('/api/me').status_code,401)
        self.assertEqual(self.admin.delete(base+'members/mu1').status_code,400)
        self.assertEqual(self.admin.delete('/api/organizations/fabrica-demo').status_code,204)
        self.assertEqual(self.admin.get('/api/me').status_code,401)

    def test_new_organization_and_isolation(self):
        other=TestClient(app)
        data=dict(nome='Nova',sobrenome='Admin',email='outra@teste.test',senha='Nova@12345',tipo='organizacao',vinculo='nova',termos=True,nome_organizacao='Outra organização',cnpj='11.222.333/0001-81',email_institucional='contato@outra.test',telefone_institucional='11999999999')
        self.assertEqual(other.post('/api/auth/register',json=data).status_code,409)
        data['cnpj']='11.444.777/0001-61'
        r=other.post('/api/auth/register',json=data)
        self.assertEqual(r.status_code,201,r.text)
        self.assertTrue(r.json()['acesso_liberado'])
        self.assertEqual(other.get('/api/solicitacoes/%230001').status_code,404)
        self.assertEqual(other.get('/api/solicitacoes').json(),[])
        self.assertEqual(other.post('/api/solicitacoes/%230001/aprovar').status_code,403)
        self.assertEqual(other.get('/api/organizations/fabrica-demo/members').status_code,403)

    def test_inventory_validation_and_stock(self):
        self.assertEqual(self.client_org.post('/api/materiais',json={}).status_code,403)
        self.assertEqual(self.factory.patch('/api/materiais/material-1',json={'quantidade':-1}).status_code,422)
        self.assertEqual(self.factory.patch('/api/materiais/material-1',json={'quantidade':0}).json()['situacao'],'Esgotado')
        self.assertEqual(self.factory.patch('/api/materiais/material-1',json={'quantidade':1}).json()['situacao'],'Estoque baixo')
        self.start()
        self.assertEqual(self.factory.delete('/api/impressoras/impressora-1').status_code,409)
        self.assertEqual(self.factory.delete('/api/materiais/material-1').status_code,409)
        self.assertEqual(self.factory.patch('/api/materiais/material-1',json={'unidade':'g'}).status_code,409)

    def test_profile_password_email_photo_and_csrf(self):
        self.assertEqual(self.factory.patch('/api/me',json={'nome':'José'}).status_code,200)
        self.assertEqual(self.factory.get('/api/me').json()['user']['nome'],'José')
        self.assertEqual(self.factory.post('/api/me/photo',files={'photo':('x.png',b'not an image')}).status_code,422)
        self.assertEqual(self.factory.post('/api/auth/logout',headers={'Origin':'https://outro.test'}).status_code,403)
        r=self.factory.post('/api/me/email/start',json={'novo_email':'novoemail@teste.test','senha_atual':'Demo@12345'})
        self.assertEqual(r.status_code,200,r.text)
        code=r.json()['message'].split('confirmar: ')[1][:6]
        self.assertEqual(self.factory.post('/api/me/email/confirm',json={'codigo':'errado'}).status_code,422)
        self.assertEqual(self.factory.post('/api/me/email/confirm',json={'codigo':code}).status_code,200)
        self.assertEqual(self.factory.get('/api/me').status_code,401)
        self.assertEqual(self.factory.post('/api/auth/login',json={'email':'novoemail@teste.test','senha':'Demo@12345'}).status_code,200)
        self.assertEqual(self.factory.post('/api/me/password',json={'senha_atual':'Demo@12345','nova_senha':'Nova@12345'}).status_code,200)
        self.assertEqual(self.factory.get('/api/me').status_code,401)

    def test_static_files_and_private_paths(self):
        for path in ('/','/html/login.html','/css/style.css','/js/api.js','/content/img/user.png'):
            self.assertEqual(self.client.get(path).status_code,200,path)
        for path in ('/data/labielos.sqlite3','/.git/config','/backend/app.py','/.runtime/python/python.exe'):
            self.assertEqual(self.client.get(path).status_code,404,path)


if __name__=='__main__':
    initialize()
    unittest.main(verbosity=2)
