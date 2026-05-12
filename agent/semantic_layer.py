# Semantic layer / data dictionary for text-to-SQL generation.
# This module defines business meaning and SQL usage rules for warehouse tables.
# LLMs should treat these descriptions as authoritative when joining tables,
# filtering metrics, and naming aggregates (GMV, revenue, geography, reviews).

TABLE_DESCRIPTIONS = {
    "fact_orders": {
        "description": (
            "Central transactional fact table: one row per order line item (not necessarily "
            "one row per logical customer order). Use this table as the spine for revenue, "
            "volume, and time-series analysis. Join to dimensions on the foreign keys below."
        ),
        "columns": {
            "order_id": (
                "Surrogate identifier for the order line or basket slice represented by this row. "
                "Use COUNT(DISTINCT order_id) when the question asks for number of orders; "
                "never count rows blindly if duplicate order_ids can exist across line items—"
                "prefer DISTINCT when 'unique orders' is intended."
            ),
            "user_id": (
                "Foreign key to dim_users.user_id. Join when filtering or grouping by customer "
                "attributes (city, state). Always qualify column names in SQL (e.g. fact_orders.user_id) "
                "when multiple tables expose *_id columns."
            ),
            "product_id": (
                "Foreign key to dim_products.product_id. Join for category_name, product_name, "
                "or listing-quality proxies like photos_qty."
            ),
            "seller_id": (
                "Foreign key to dim_sellers.seller_id. Join when analyzing seller geography "
                "or performance; do not confuse with user_id (buyer vs seller)."
            ),
            "order_total_usd": (
                "Final line revenue in USD after tax—this is the canonical monetary measure for "
                "GMV, sales, and revenue. Sum or average this column for dollar metrics. "
                "Never substitute freight_value_usd as revenue or GMV; freight is cost-only."
            ),
            "freight_value_usd": (
                "Shipping/freight charge in USD for this line—logistics cost, not merchandise revenue. "
                "Use for shipping analysis or margin-style questions only; exclude from GMV/revenue KPIs."
            ),
            "order_status": (
                "Lifecycle state of the order line. Known values include: delivered, shipped, "
                "canceled, unavailable, processing. For revenue and GMV reporting, restrict with "
                "WHERE order_status = 'delivered' unless the question explicitly asks for other states "
                "(e.g. cancellation rate). Omitting this filter inflates metrics with non-final states."
            ),
            "created_at": (
                "Timestamp when the order row was created—use for daily/weekly/monthly trends, "
                "cohorts, and range filters (e.g. WHERE created_at >= ...). Prefer this over "
                "inferred dates from other tables for order timing."
            ),
        },
    },
    "dim_users": {
        "description": (
            "Customer dimension: one row per buyer (user). Join from fact_orders on user_id "
            "to analyze demand by geography at the customer location (not seller location)."
        ),
        "columns": {
            "user_id": (
                "Primary key; matches fact_orders.user_id. Use for deduplicating customers "
                "or joining reviews/orders back to profile attributes."
            ),
            "city": (
                "Customer's city name as stored in the dimension—use for city-level breakdowns "
                "and maps text; pair with state for uniqueness where needed."
            ),
            "state": (
                "Two-letter Brazilian federative unit code (e.g. SP, RJ, MG). Use for regional "
                "filters and GROUP BY in geographic analysis; compare using exact codes, not full names."
            ),
        },
    },
    "dim_products": {
        "description": (
            "Product catalog dimension: attributes describing the merchandise—not prices or "
            "quantities from orders (those live on fact_orders)."
        ),
        "columns": {
            "product_id": (
                "Primary key; matches fact_orders.product_id. Required join anchor for product-level reporting."
            ),
            "category_name": (
                "Merchandising category label in English—use GROUP BY category_name for category "
                "mix, top categories, and assortment questions."
            ),
            "product_name": (
                "Human-readable SKU/product title for drill-down and filtering; too granular "
                "for high-level KPIs unless explicitly requested."
            ),
            "photos_qty": (
                "Count of gallery images on the listing—treat as a proxy for listing completeness "
                "or quality; suitable for correlations or segmentation, not as revenue."
            ),
        },
    },
    "dim_sellers": {
        "description": (
            "Seller dimension: describes the merchant fulfilling orders. Join from fact_orders "
            "on seller_id when the question concerns seller-side geography or seller entities."
        ),
        "columns": {
            "seller_id": (
                "Primary key; matches fact_orders.seller_id. Distinct seller counts use "
                "COUNT(DISTINCT seller_id) after appropriate fact table filters."
            ),
            "seller_city": (
                "Seller's operational city—use for logistics or supply-side geographic views; "
                "do not substitute for customer city on buyer-centric questions."
            ),
            "seller_state": (
                "Two-letter Brazilian state code for the seller—same conventions as dim_users.state; "
                "use when grouping seller performance by region."
            ),
        },
    },
    "dim_reviews": {
        "description": (
            "Post-purchase reviews tied to orders. Join to fact_orders on order_id for sentiment "
            "and quality metrics alongside commercial facts."
        ),
        "columns": {
            "review_id": (
                "Primary key for the review row—use COUNT(DISTINCT review_id) for number of reviews."
            ),
            "order_id": (
                "Foreign key to fact_orders.order_id—join to attach scores to monetary outcomes "
                "or dates; one order may map to one review depending on business rules."
            ),
            "review_score": (
                "Integer rating from 1 (worst) to 5 (best). Use AVG(review_score) for mean satisfaction "
                "or NPS-style summaries; use WHERE review_score >= 4 for 'positive' share and "
                "WHERE review_score <= 2 for complaint-heavy subsets. Combine with delivered-order "
                "filters when analyzing revenue-weighted satisfaction."
            ),
            "review_comment": (
                "Unstructured review text—use for qualitative filtering only if supported; "
                "numeric KPIs should rely on review_score."
            ),
        },
    },
    "dim_geography": {
        "description": (
            "Reference geography keyed by geo_id (ZIP-prefix style Brazilian logistics hierarchy). "
            "Join when lat/lng or standardized city/state from zip prefix is required; align join keys "
            "with upstream ETL conventions if linking from user or seller addresses."
        ),
        "columns": {
            "geo_id": (
                "Surrogate primary key for this geography row—use when fact tables store geo_id "
                "or when deduplicating geographic entities."
            ),
            "zip_code_prefix": (
                "Brazilian postal code prefix segment—often used for coarse regional clustering "
                "before city/state; filter or group with leading-digit logic only if the schema expects it."
            ),
            "city": (
                "Canonical city label in this lookup—may normalize spelling vs free-text address fields."
            ),
            "state": (
                "Two-letter state code consistent with other dimensions—use for rolling up to region."
            ),
            "lat": (
                "Latitude in decimal degrees—pair with lng for distance or mapping; verify CRS assumptions "
                "with project defaults (usually WGS84)."
            ),
            "lng": (
                "Longitude in decimal degrees—always select lat and lng together for geo plotting "
                "or haversine-style distance filters."
            ),
        },
    },
}
