use uuid::Uuid;

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn now_iso() -> String {
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .expect("Rfc3339 format is infallible for OffsetDateTime")
}
