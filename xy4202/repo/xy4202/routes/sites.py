from flask import Blueprint, request, jsonify
from extensions import db
from models.models import Site

sites = Blueprint('sites', __name__)

@sites.route('/', methods=['GET'])
def get_sites():
    site_list = Site.query.all()
    return jsonify([site.to_dict() for site in site_list]), 200

@sites.route('/<int:site_id>', methods=['GET'])
def get_site(site_id):
    site = Site.query.get_or_404(site_id)
    return jsonify(site.to_dict()), 200

@sites.route('/', methods=['POST'])
def create_site():
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': '站点名称不能为空'}), 400
    
    site = Site(
        name=data['name'],
        address=data.get('address'),
        contact_person=data.get('contact_person'),
        phone=data.get('phone')
    )
    
    db.session.add(site)
    db.session.commit()
    
    return jsonify(site.to_dict()), 201

@sites.route('/<int:site_id>', methods=['PUT'])
def update_site(site_id):
    site = Site.query.get_or_404(site_id)
    data = request.get_json()
    
    if 'name' in data:
        site.name = data['name']
    if 'address' in data:
        site.address = data['address']
    if 'contact_person' in data:
        site.contact_person = data['contact_person']
    if 'phone' in data:
        site.phone = data['phone']
    
    db.session.commit()
    
    return jsonify(site.to_dict()), 200

@sites.route('/<int:site_id>', methods=['DELETE'])
def delete_site(site_id):
    site = Site.query.get_or_404(site_id)
    
    db.session.delete(site)
    db.session.commit()
    
    return jsonify({'message': '站点已删除'}), 200
