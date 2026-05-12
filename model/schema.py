# Star schema ORM definitions: dimensions, fact_orders grain, and query audit table.

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from model.database import Base


class DimUser(Base):
    __tablename__ = "dim_users"

    user_id = Column(String, primary_key=True)
    city = Column(String)
    state = Column(String)
    zip_code_prefix = Column(String)


class DimProduct(Base):
    __tablename__ = "dim_products"

    product_id = Column(String, primary_key=True)
    category_name = Column(String)
    product_name = Column(String)
    photos_qty = Column(Integer)


class DimSeller(Base):
    __tablename__ = "dim_sellers"

    seller_id = Column(String, primary_key=True)
    seller_city = Column(String)
    seller_state = Column(String)


class DimGeography(Base):
    __tablename__ = "dim_geography"

    geo_id = Column(Integer, primary_key=True, autoincrement=True)
    zip_code_prefix = Column(String)
    city = Column(String)
    state = Column(String)
    lat = Column(Float)
    lng = Column(Float)


class FactOrder(Base):
    __tablename__ = "fact_orders"

    order_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("dim_users.user_id"))
    product_id = Column(String, ForeignKey("dim_products.product_id"))
    seller_id = Column(String, ForeignKey("dim_sellers.seller_id"))
    order_total_usd = Column(Float)
    freight_value_usd = Column(Float)
    order_status = Column(String)
    created_at = Column(DateTime)


class DimReview(Base):
    __tablename__ = "dim_reviews"

    review_id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("fact_orders.order_id"))
    review_score = Column(Integer)
    review_comment = Column(String)


class QueryLog(Base):
    __tablename__ = "query_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question = Column(String)
    generated_sql = Column(Text)
    tables_used = Column(String)
    latency_ms = Column(Float)
    explain_requested = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)
