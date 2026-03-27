export type NodeChild = Node | Element | Text | Comment | string | number | (() => NodeChild) | null | undefined;
export type NodeChildren = NodeChild | NodeChild[] | (() => string);
