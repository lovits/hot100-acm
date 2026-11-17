#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>




struct TreeNode* lowestCommonAncestor(struct TreeNode* root, struct TreeNode* p, struct TreeNode* q)
{
    if (root == NULL || root == p || root == q) {
        /* edge cases: if return NULL then no p or q node in this path */
        return root;
    }

    /* l is the LCA in the left branch but not root->left */
    struct TreeNode *l = lowestCommonAncestor(root->left, p, q);
    /* r is the LCA in the right branch but not root->right */
    struct TreeNode *r = lowestCommonAncestor(root->right, p, q);
    if (l != NULL && r != NULL) {
        return root;
    } else {
        /* if not return root node, the return value is fixed */
        return l != NULL ? l : r;
    }
}
