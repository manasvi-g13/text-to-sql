"""
Load Olist CSV exports into the local SQLite star schema (data/olist.db).
"""

from __future__ import annotations

import traceback
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
)

load_dotenv()

BASE = Path(__file__).resolve().parent
RAW = BASE / "raw"
DB_PATH = BASE / "olist.db"


def _read_csv(name: str, *, alt_names: tuple[str, ...] = ()) -> pd.DataFrame:
    names = (name,) + alt_names
    for csv_name in names:
        for folder in (RAW, RAW / "archive"):
            path = folder / csv_name
            if path.exists():
                return pd.read_csv(
                    path,
                    encoding="utf-8",
                    on_bad_lines="skip",
                )
    raise FileNotFoundError(
        f"Could not find {name!r} (or alternates {alt_names!r}) under {RAW} or {RAW / 'archive'}"
    )


def _print_loaded(table: str, df: pd.DataFrame) -> None:
    print(f"✓ Loaded {table}: {len(df)} rows")


def _ensure_query_log_table(engine) -> None:
    """Create the query_log table (used by agent/sql_chain.py to audit queries)
    if it doesn't already exist. Matches model.schema.QueryLog."""
    metadata = MetaData()
    Table(
        "query_log",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("question", String),
        Column("generated_sql", Text),
        Column("tables_used", String),
        Column("latency_ms", Float),
        Column("explain_requested", Boolean),
        Column("created_at", DateTime),
    )
    metadata.create_all(engine, checkfirst=True)
    print("✓ Ensured query_log table exists")


def main() -> None:
    engine = create_engine(f"sqlite:///{DB_PATH}")

    customers = _read_csv("olist_customers_dataset.csv")
    orders = _read_csv("olist_orders_dataset.csv")
    order_items = _read_csv("olist_order_items_dataset.csv")
    products = _read_csv("olist_products_dataset.csv")
    sellers = _read_csv("olist_sellers_dataset.csv")
    reviews = _read_csv("olist_order_reviews_dataset.csv")
    geolocation = _read_csv("olist_geolocation_dataset.csv")
    cat_trans = _read_csv(
        "olist_product_category_name_translation.csv",
        alt_names=("product_category_name_translation.csv",),
    )

    # dim_users
    dim_users = customers.rename(
        columns={
            "customer_id": "user_id",
            "customer_city": "city",
            "customer_state": "state",
            "customer_zip_code_prefix": "zip_code_prefix",
        }
    )[["user_id", "city", "state", "zip_code_prefix"]]
    dim_users = dim_users.drop_duplicates(subset=["user_id"], ignore_index=True)
    dim_users.to_sql("dim_users", engine, if_exists="replace", index=False)
    _print_loaded("dim_users", dim_users)

    # dim_products (English category via translation)
    p = products.merge(
        cat_trans,
        on="product_category_name",
        how="left",
    )
    p["category_name"] = p["product_category_name_english"].fillna("unknown")
    if "product_name" in p.columns:
        p["product_name"] = p["product_name"].fillna("")
    else:
        p["product_name"] = ""
    p["photos_qty"] = p["product_photos_qty"]
    dim_products = p[["product_id", "category_name", "product_name", "photos_qty"]].copy()
    dim_products["category_name"] = dim_products["category_name"].replace("", "unknown")
    dim_products = dim_products.drop_duplicates(subset=["product_id"], ignore_index=True)
    dim_products.to_sql("dim_products", engine, if_exists="replace", index=False)
    _print_loaded("dim_products", dim_products)

    # dim_sellers
    dim_sellers = sellers[["seller_id", "seller_city", "seller_state"]].copy()
    dim_sellers = dim_sellers.drop_duplicates(subset=["seller_id"], ignore_index=True)
    dim_sellers.to_sql("dim_sellers", engine, if_exists="replace", index=False)
    _print_loaded("dim_sellers", dim_sellers)

    # dim_reviews
    dim_reviews = reviews.rename(
        columns={"review_comment_message": "review_comment"}
    )[["review_id", "order_id", "review_score", "review_comment"]]
    dim_reviews = dim_reviews.drop_duplicates(subset=["review_id"], ignore_index=True)
    dim_reviews["review_comment"] = dim_reviews["review_comment"].fillna("")
    dim_reviews.to_sql("dim_reviews", engine, if_exists="replace", index=False)
    _print_loaded("dim_reviews", dim_reviews)

    # dim_geography
    dim_geo = geolocation.rename(
        columns={
            "geolocation_zip_code_prefix": "zip_code_prefix",
            "geolocation_city": "city",
            "geolocation_state": "state",
            "geolocation_lat": "lat",
            "geolocation_lng": "lng",
        }
    )[["zip_code_prefix", "city", "state", "lat", "lng"]]
    dim_geo = dim_geo.drop_duplicates(subset=["zip_code_prefix"], ignore_index=True)
    dim_geo.to_sql("dim_geography", engine, if_exists="replace", index=False)
    _print_loaded("dim_geography", dim_geo)

    # fact_orders (one row per order line item)
    orders_keys = orders[
        ["order_id", "customer_id", "order_status", "order_purchase_timestamp"]
    ]
    fact_orders = order_items.merge(orders_keys, on="order_id", how="inner")
    fact_orders = fact_orders.rename(
        columns={
            "customer_id": "user_id",
            "price": "order_total_usd",
            "freight_value": "freight_value_usd",
            "order_purchase_timestamp": "created_at",
        }
    )
    fact_orders = fact_orders[
        [
            "order_id",
            "user_id",
            "product_id",
            "seller_id",
            "order_total_usd",
            "freight_value_usd",
            "order_status",
            "created_at",
        ]
    ]
    fact_orders = fact_orders.dropna(subset=["order_id", "user_id"])
    fact_orders["created_at"] = pd.to_datetime(fact_orders["created_at"], errors="coerce")
    fact_orders.to_sql("fact_orders", engine, if_exists="replace", index=False)
    _print_loaded("fact_orders", fact_orders)

    _ensure_query_log_table(engine)

    print("✓ Database seeded successfully")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
