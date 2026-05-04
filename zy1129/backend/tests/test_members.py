import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Member


@pytest.mark.asyncio
class TestMemberAPI:
    
    async def test_list_members_empty(self, client: AsyncClient):
        response = await client.get("/api/members/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    async def test_create_member(self, client: AsyncClient, async_session: AsyncSession):
        member_data = {
            "name": "测试成员",
            "relationship": "测试关系",
            "birth_date": "1990-01-15",
            "gender": "男",
            "notes": "测试备注"
        }
        
        response = await client.post("/api/members/", json=member_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "测试成员"
        assert data["relationship"] == "测试关系"
        assert data["birth_date"] == "1990-01-15"
        assert data["gender"] == "男"
        assert data["notes"] == "测试备注"
        assert "id" in data
        
        result = await async_session.execute(
            select(Member).where(Member.id == data["id"])
        )
        db_member = result.scalar_one_or_none()
        assert db_member is not None
        assert db_member.name == "测试成员"
    
    async def test_create_member_required_fields(self, client: AsyncClient):
        invalid_data = {
            "name": "测试成员"
        }
        
        response = await client.post("/api/members/", json=invalid_data)
        assert response.status_code == 422
        
        invalid_data_2 = {
            "relationship": "父亲"
        }
        
        response = await client.post("/api/members/", json=invalid_data_2)
        assert response.status_code == 422
    
    async def test_get_member_by_id(self, client: AsyncClient, async_session: AsyncSession):
        member = Member(
            name="张三",
            relationship="父亲",
            birth_date="1980-05-15",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        response = await client.get(f"/api/members/{member.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == member.id
        assert data["name"] == "张三"
        assert data["relationship"] == "父亲"
    
    async def test_get_member_not_found(self, client: AsyncClient):
        response = await client.get("/api/members/9999")
        assert response.status_code == 404
    
    async def test_update_member(self, client: AsyncClient, async_session: AsyncSession):
        member = Member(
            name="李四",
            relationship="母亲",
            birth_date="1982-08-20",
            gender="女"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        update_data = {
            "name": "李四2",
            "notes": "更新后的备注"
        }
        
        response = await client.put(f"/api/members/{member.id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "李四2"
        assert data["notes"] == "更新后的备注"
        assert data["relationship"] == "母亲"
    
    async def test_update_member_not_found(self, client: AsyncClient):
        update_data = {
            "name": "不存在的成员"
        }
        
        response = await client.put("/api/members/9999", json=update_data)
        assert response.status_code == 404
    
    async def test_delete_member(self, client: AsyncClient, async_session: AsyncSession):
        member = Member(
            name="王五",
            relationship="儿子",
            birth_date="2010-03-10",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        member_id = member.id
        
        result = await async_session.execute(
            select(Member).where(Member.id == member_id)
        )
        assert result.scalar_one_or_none() is not None
        
        response = await client.delete(f"/api/members/{member_id}")
        assert response.status_code == 204
        
        await async_session.expire_all()
        result = await async_session.execute(
            select(Member).where(Member.id == member_id)
        )
        assert result.scalar_one_or_none() is None
    
    async def test_delete_member_not_found(self, client: AsyncClient):
        response = await client.delete("/api/members/9999")
        assert response.status_code == 404
    
    async def test_list_members_with_data(self, client: AsyncClient, async_session: AsyncSession):
        members = [
            Member(name="成员1", relationship="父亲"),
            Member(name="成员2", relationship="母亲"),
            Member(name="成员3", relationship="儿子"),
        ]
        async_session.add_all(members)
        await async_session.commit()
        
        response = await client.get("/api/members/")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 3
        names = {m["name"] for m in data}
        assert "成员1" in names
        assert "成员2" in names
        assert "成员3" in names
